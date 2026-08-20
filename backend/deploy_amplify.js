import 'dotenv/config';
import {
  AmplifyClient,
  ListAppsCommand,
  CreateAppCommand,
  UpdateAppCommand,
  GetBranchCommand,
  CreateBranchCommand,
  ListJobsCommand,
  StopJobCommand,
  CreateDeploymentCommand,
  StartDeploymentCommand,
  GetJobCommand,
} from '@aws-sdk/client-amplify';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const region = 'us-east-1';

const amplify = new AmplifyClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

function zipDirectory(sourceDir, outPath) {
  if (fs.existsSync(outPath)) {
    fs.unlinkSync(outPath);
  }
  const zip = new AdmZip();
  zip.addLocalFolder(sourceDir);
  zip.writeZip(outPath);
}

function uploadZip(uploadUrl, zipFilePath) {
  return new Promise((resolve, reject) => {
    const fileStats = fs.statSync(zipFilePath);
    const url = new URL(uploadUrl);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': fileStats.size,
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status code ${res.statusCode}`));
      }
    });

    req.on('error', reject);
    fs.createReadStream(zipFilePath).pipe(req);
  });
}

async function run() {
  console.log('🚀 Starting WORKONOVA Frontend Deployment to AWS Amplify...');

  try {
    const distPath = path.resolve(__dirname, '../frontend/dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(`Frontend build directory not found at: ${distPath}. Please build frontend first (npm run build in frontend).`);
    }

    // ── 1. Create or Find AWS Amplify App ──
    const appsList = await amplify.send(new ListAppsCommand({ maxResults: 50 }));
    let app = appsList.apps?.find((a) => a.name === 'workonova-frontend');

    if (!app) {
      console.log('🌱 Creating new AWS Amplify Application: workonova-frontend...');
      const createRes = await amplify.send(
        new CreateAppCommand({
          name: 'workonova-frontend',
          description: 'Workonova Production Frontend SPA',
          customRules: [
            {
              source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|eot|otf|map|json|webp|mp4|webm|m4v|avif)$)([^.]+$)/>',
              target: '/index.html',
              status: '200',
            },
          ],
        })
      );
      app = createRes.app;
      console.log(`✅ Amplify App created with ID: ${app.appId}`);
    } else {
      console.log(`📦 Using existing AWS Amplify App ID: ${app.appId}`);
      await amplify.send(
        new UpdateAppCommand({
          appId: app.appId,
          customRules: [
            {
              source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|eot|otf|map|json|webp|mp4|webm|m4v|avif)$)([^.]+$)/>',
              target: '/index.html',
              status: '200',
            },
          ],
        })
      );
    }

    const appId = app.appId;
    const branchName = 'main';

    // ── 2. Create or verify Branch ──
    let branchExists = false;
    try {
      await amplify.send(new GetBranchCommand({ appId, branchName }));
      branchExists = true;
    } catch {
      branchExists = false;
    }

    if (!branchExists) {
      console.log(`🌿 Creating branch: ${branchName}...`);
      await amplify.send(
        new CreateBranchCommand({
          appId,
          branchName,
          stage: 'PRODUCTION',
          enableAutoBuild: false,
        })
      );
      console.log(`✅ Branch ${branchName} created!`);
    }

    // ── 3. Zip dist directory ──
    const zipPath = path.resolve(__dirname, 'frontend-build.zip');
    console.log('📦 Zipping frontend build artifacts...');
    await zipDirectory(distPath, zipPath);
    console.log('✅ Build artifacts zipped.');

    // ── 4. Cancel any previous in-progress jobs to avoid conflict ──
    try {
      const jobsList = await amplify.send(new ListJobsCommand({ appId, branchName, maxResults: 5 }));
      for (const j of jobsList.jobSummaries || []) {
        if (j.status === 'PENDING' || j.status === 'PROVISIONING' || j.status === 'RUNNING') {
          console.log(`⏹️ Stopping previous job ${j.jobId} (status: ${j.status})...`);
          try {
            await amplify.send(new StopJobCommand({ appId, branchName, jobId: j.jobId }));
            await new Promise(r => setTimeout(r, 2000));
          } catch (stopErr) {
            console.log(`Note on stop job: ${stopErr.message}`);
          }
        }
      }
    } catch (listErr) {
      // Ignore if list fails
    }

    // ── 5. Create Deployment ──
    console.log('🌐 Requesting deployment slot from AWS Amplify...');
    const deployment = await amplify.send(
      new CreateDeploymentCommand({
        appId,
        branchName,
      })
    );

    const { jobId, zipUploadUrl } = deployment;
    console.log(`📤 Uploading zip bundle to Amplify (Job ID: ${jobId})...`);
    await uploadZip(zipUploadUrl, zipPath);
    console.log('✅ Upload finished.');

    // ── 5. Start Deployment ──
    console.log('🚀 Triggering Amplify deployment...');
    await amplify.send(
      new StartDeploymentCommand({
        appId,
        branchName,
        jobId,
      })
    );

    // Clean up temporary zip
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }

    // ── 6. Monitor Deployment Status ──
    console.log('⏳ Awaiting deployment confirmation from Amplify...');
    let status = 'RUNNING';
    let attempts = 0;
    while (status === 'RUNNING' || status === 'PENDING' || status === 'PROVISIONING') {
      await new Promise((r) => setTimeout(r, 4000));
      attempts++;
      const jobRes = await amplify.send(new GetJobCommand({ appId, branchName, jobId }));
      status = jobRes.job?.summary?.status || 'UNKNOWN';
      console.log(`   Status [${attempts * 4}s]: ${status}`);
      if (status === 'SUCCEED') break;
      if (status === 'FAILED' || status === 'CANCELLED') {
        throw new Error(`Amplify deployment failed with status: ${status}`);
      }
      if (attempts > 30) break; // Timeout after 2 minutes
    }

    const defaultDomain = app.defaultDomain;
    const amplifyUrl = `https://${branchName}.${defaultDomain}`;

    console.log('\n🎉 WORKONOVA FRONTEND DEPLOYMENT TO AMPLIFY COMPLETE!');
    console.log(`🔗 Live Amplify URL: ${amplifyUrl}`);
    console.log(`🔗 App Management Console: https://${region}.console.aws.amazon.com/amplify/home?region=${region}#/${appId}`);
  } catch (err) {
    console.error('❌ Amplify deployment failed:', err.message || err);
    process.exit(1);
  }
}

run();
