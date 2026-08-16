import nodemailer from 'nodemailer';

// ── Environment configurations ──
const SMTP_SERVICE = process.env.SMTP_SERVICE || ''; // e.g. 'gmail'
const SMTP_HOST = process.env.SMTP_HOST || '';       // e.g. 'smtp.gmail.com' or 'smtp.resend.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';       // Your email address (e.g. info@workonova.com)
const SMTP_PASS = process.env.SMTP_PASS || '';       // App Password / SMTP Key
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `"WORKONOVA" <${SMTP_USER}>` : '"WORKONOVA" <noreply@workonova.com>');

// Create Nodemailer Transporter
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    if (SMTP_SERVICE.toLowerCase() === 'gmail' && SMTP_USER && SMTP_PASS) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS, // Gmail App Password (16 chars)
        },
      });
      console.log(`📧 Nodemailer transport initialized using Gmail service for ${SMTP_USER}`);
    } else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      console.log(`📧 Nodemailer transport initialized using SMTP host ${SMTP_HOST}:${SMTP_PORT}`);
    } else {
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      console.log(`ℹ️ SMTP credentials missing in .env — Emails will be simulated in server logs.`);
    }
  }
  return transporter;
}

// ── Generic Email Sender Helper ──
async function sendMail(to: string, subject: string, html: string, text: string) {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    });

    if (!SMTP_USER && !SMTP_PASS) {
      console.log(`ℹ️ SIMULATED EMAIL to ${to} | Subject: "${subject}"`);
      console.log(`   (Configure SMTP_USER and SMTP_PASS in backend/.env to send real emails to your inbox)`);
    } else {
      console.log(`✅ REAL EMAIL DELIVERED to ${to} | Subject: "${subject}" | MessageID: ${info.messageId}`);
    }
    return true;
  } catch (err: any) {
    console.error(`❌ Failed to deliver email to ${to}:`, err.message || err);
    return false;
  }
}

// ── 1. Send OTP Verification Email ──
export async function sendOtpEmail(toEmail: string, name: string, otpCode: string) {
  const subject = `🔐 ${otpCode} is your Workonova Security Verification Code`;
  const text = `Hello ${name},\n\nYour Workonova verification code is: ${otpCode}.\n\nThis code will expire in 10 minutes.\n\nBest regards,\nWORKONOVA Team`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f1117; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 550px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: 2px;">WORKONOVA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">MANAGED CREATIVE & TECH MARKETPLACE</p>
      </div>
      <div style="background: #1e2230; padding: 28px; border-radius: 10px; border: 1px solid #2e344a;">
        <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">Verification Required</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Use the secure OTP below to verify your email address and continue on WORKONOVA:</p>
        <div style="background: #0f1117; padding: 18px; text-align: center; border-radius: 8px; margin: 24px 0; border: 1px solid #6366f1;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #818cf8;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">This code is valid for 10 minutes. If you did not request this, please ignore this email.</p>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
        © 2026 WORKONOVA · Encrypted & Meditated Client-Freelancer Infrastructure
      </div>
    </div>
  `;

  return sendMail(toEmail, subject, html, text);
}

// ── 2. Send Welcome Account Email ──
export async function sendWelcomeEmail(toEmail: string, name: string, role: string) {
  const roleLabel = role === 'freelancer' ? 'Vetted Specialist' : 'Client';
  const subject = `🚀 Welcome to WORKONOVA, ${name}!`;
  const text = `Welcome ${name}! Your ${roleLabel} account has been activated on Workonova.`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f1117; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 550px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: 2px;">WORKONOVA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">MANAGED CREATIVE & TECH MARKETPLACE</p>
      </div>
      <div style="background: #1e2230; padding: 28px; border-radius: 10px; border: 1px solid #2e344a;">
        <h2 style="margin-top: 0; color: #38bdf8; font-size: 22px;">Welcome Aboard, ${name}! 🎉</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Your <strong>${roleLabel}</strong> workspace is officially ready.</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
          ${role === 'freelancer' 
            ? 'You can now access your anonymized blind task dashboard, view assigned projects, deliver assets, and track payouts.'
            : 'You can now browse fixed-price bundles, submit project briefs via Drive/Dropbox, track live progress, and manage deliverables.'}
        </p>
        <div style="margin-top: 28px; text-align: center;">
          <a href="http://localhost:5173" style="background: #6366f1; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Open Dashboard ↗</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
        © 2026 WORKONOVA · 24/7 Managed Platform Support
      </div>
    </div>
  `;

  return sendMail(toEmail, subject, html, text);
}

// ── 3. Send Order Update Email ──
export async function sendOrderUpdateEmail(toEmail: string, name: string, orderId: number, statusTitle: string, details: string) {
  const subject = `🔔 Order #WN-${orderId} Update: ${statusTitle}`;
  const text = `Hello ${name},\n\nOrder #WN-${orderId} update: ${statusTitle}\n${details}`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f1117; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 550px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: 2px;">WORKONOVA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">MANAGED CREATIVE & TECH MARKETPLACE</p>
      </div>
      <div style="background: #1e2230; padding: 28px; border-radius: 10px; border: 1px solid #2e344a;">
        <div style="display: inline-block; background: #312e81; color: #a5b4fc; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 12px;">ORDER #WN-${orderId}</div>
        <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">${statusTitle}</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">${details}</p>
        <div style="margin-top: 24px; text-align: center;">
          <a href="http://localhost:5173" style="background: #10b981; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">View Live Status ↗</a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
        © 2026 WORKONOVA · 100% Encrypted & QA Verified
      </div>
    </div>
  `;

  return sendMail(toEmail, subject, html, text);
}

// ── 4. Send Password Reset OTP Email ──
export async function sendPasswordResetEmail(toEmail: string, name: string, otpCode: string) {
  const subject = `🔑 Reset your Workonova password`;
  const text = `Hello ${name},\n\nYour password reset code is: ${otpCode}\n\nThis code expires in 10 minutes. If you didn't request this, please ignore.\n\nWorkonova Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; background-color: #0f1117; color: #ffffff; padding: 40px 20px; border-radius: 12px; max-width: 550px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #6366f1; margin: 0; font-size: 28px; letter-spacing: 2px;">WORKONOVA</h1>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">MANAGED CREATIVE & TECH MARKETPLACE</p>
      </div>
      <div style="background: #1e2230; padding: 28px; border-radius: 10px; border: 1px solid #2e344a;">
        <h2 style="margin-top: 0; color: #f8fafc; font-size: 20px;">🔑 Password Reset Request</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">Enter this OTP to reset your Workonova password:</p>
        <div style="background: #0f1117; padding: 18px; text-align: center; border-radius: 8px; margin: 24px 0; border: 1px solid #f59e0b;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #fbbf24;">${otpCode}</span>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">Valid for 10 minutes. If you didn't request this, you can safely ignore this email — your password will not change.</p>
      </div>
      <div style="text-align: center; margin-top: 24px; color: #64748b; font-size: 12px;">
        © 2026 WORKONOVA · Secure Password Management
      </div>
    </div>
  `;

  return sendMail(toEmail, subject, html, text);
}

