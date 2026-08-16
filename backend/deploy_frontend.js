import 'dotenv/config';
import { 
  S3Client, 
  ListBucketsCommand, 
  CreateBucketCommand, 
  PutBucketWebsiteCommand, 
  PutPublicAccessBlockCommand, 
  PutBucketPolicyCommand, 
  PutObjectCommand 
} from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import mime from 'mime-types';

const region = 'us-east-1';

// Initialize S3 Client using credentials from .env
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  }
});

// Helper to recursively list files in a folder
function getFiles(dir) {
  const files = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    const filePath = path.join(dir, item);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      files.push(...getFiles(filePath));
    } else {
      files.push(filePath);
    }
  }
  return files;
}

async function run() {
  console.log('🚀 Starting WORKONOVA Frontend Deployment to AWS S3...');

  try {
    // ── 1. Find or Create S3 Bucket ──
    const bucketsResponse = await s3.send(new ListBucketsCommand({}));
    const allBuckets = bucketsResponse.Buckets || [];
    
    // Check if we already have a workonova-frontend bucket
    let bucketName = allBuckets.find(b => b.Name.startsWith('workonova-frontend'))?.Name;

    if (bucketName) {
      console.log(`📦 Reusing existing S3 bucket: ${bucketName}`);
    } else {
      // Create a unique bucket name
      bucketName = `workonova-frontend-${Math.floor(Math.random() * 10000000)}`;
      console.log(`🌱 Creating new S3 bucket: ${bucketName}...`);
      await s3.send(new CreateBucketCommand({
        Bucket: bucketName,
      }));
      console.log(`✅ Bucket ${bucketName} created!`);
    }

    // ── 2. Configure Public Access Block (Disable Blocks to allow public site) ──
    console.log('🔓 Configuring public access settings for S3 website...');
    await s3.send(new PutPublicAccessBlockCommand({
      Bucket: bucketName,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: false,
        IgnorePublicAcls: false,
        BlockPublicPolicy: false,
        RestrictPublicBuckets: false,
      }
    }));

    // ── 3. Configure Bucket Policy for Public Read Access ──
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`,
        }
      ]
    };

    await s3.send(new PutBucketPolicyCommand({
      Bucket: bucketName,
      Policy: JSON.stringify(policy),
    }));
    console.log('✅ Bucket policy updated to allow public reads.');

    // ── 4. Configure Static Website Hosting ──
    console.log('🌐 Configuring static website hosting on S3...');
    await s3.send(new PutBucketWebsiteCommand({
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: { Suffix: 'index.html' },
        ErrorDocument: { Key: 'index.html' }, // SPA routing redirect
      }
    }));

    // ── 5. Upload built files ──
    const distPath = path.resolve('../frontend/dist');
    if (!fs.existsSync(distPath)) {
      throw new Error(`Frontend build directory not found at: ${distPath}. Please build frontend first.`);
    }

    const files = getFiles(distPath);
    console.log(`📤 Uploading ${files.length} files to S3...`);

    for (const file of files) {
      const relativePath = path.relative(distPath, file).replace(/\\/g, '/');
      const fileStream = fs.createReadStream(file);
      const contentType = mime.lookup(file) || 'application/octet-stream';

      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: relativePath,
        Body: fileStream,
        ContentType: contentType,
      }));
      console.log(`   Uploaded: ${relativePath} (${contentType})`);
    }

    console.log('\n🎉 FRONTEND DEPLOYMENT COMPLETE!');
    console.log(`🔗 Website URL: http://${bucketName}.s3-website-${region}.amazonaws.com`);
  } catch (err) {
    console.error('❌ Frontend deployment failed:', err.message || err);
    process.exit(1);
  }
}

run();
