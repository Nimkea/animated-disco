import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const SMTP_HOST = 'smtp-relay.brevo.com';
const SMTP_PORT = 587;
const SMTP_USER = '95624d002@smtp-brevo.com';
const SMTP_PASS = process.env.SMTP_PASSWORD;
const FROM_EMAIL = 'NextGen Rise Foundation <noreply@xnrt.org>';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (!SMTP_PASS) {
      throw new Error('SMTP_PASSWORD environment variable is not set');
    }

    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false, // use STARTTLS
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const transport = getTransporter();

  await transport.sendMail({
    from: FROM_EMAIL,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
  });
}

export function generateVerificationEmailHTML(username: string, verificationLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email - XNRT</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
        <tr>
          <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
            <h1 style="color: #d4a72c; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: 1px;">XNRT</h1>
            <p style="color: #888; font-size: 14px; margin: 5px 0 0 0;">NextGen Gamification Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; background-color: #1a1a1a;">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Welcome to XNRT, ${username}! 🚀</h2>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Thank you for joining the XNRT community! We're excited to have you on board.
            </p>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
              To get started and access all the amazing features of our platform, please verify your email address by clicking the button below:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #d4a72c 0%, #f4c542 100%); color: #000000; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(212, 167, 44, 0.3);">
                Verify Email Address
              </a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Or copy and paste this link into your browser:<br>
              <a href="${verificationLink}" style="color: #d4a72c; word-break: break-all;">${verificationLink}</a>
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              This verification link will expire in 24 hours.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; background-color: #0a0a0a; border-top: 1px solid #2a2a2a;">
            <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong style="color: #888;">Start Earning:</strong> Stake, mine, refer friends, and complete tasks to earn XNRT tokens!
            </p>
            <p style="color: #666; font-size: 12px; margin: 20px 0 0 0;">
              If you didn't create an account with XNRT, please ignore this email.
            </p>
            <p style="color: #444; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
              © ${new Date().getFullYear()} NextGen Rise Foundation. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export function generatePasswordResetEmailHTML(username: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - XNRT</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #0a0a0a;">
        <tr>
          <td style="padding: 40px 20px; text-align: center; background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);">
            <h1 style="color: #d4a72c; font-size: 32px; margin: 0; font-weight: 700; letter-spacing: 1px;">XNRT</h1>
            <p style="color: #888; font-size: 14px; margin: 5px 0 0 0;">NextGen Gamification Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 40px 30px; background-color: #1a1a1a;">
            <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Password Reset Request</h2>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              Hi ${username},
            </p>
            <p style="color: #cccccc; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              We received a request to reset your password for your XNRT account. If you made this request, click the button below to reset your password:
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #d4a72c 0%, #f4c542 100%); color: #000000; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(212, 167, 44, 0.3);">
                Reset Password
              </a>
            </div>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0;">
              Or copy and paste this link into your browser:<br>
              <a href="${resetLink}" style="color: #d4a72c; word-break: break-all;">${resetLink}</a>
            </p>
            <p style="color: #888; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
              This password reset link will expire in 1 hour for security reasons.
            </p>
            <div style="margin: 30px 0; padding: 15px; background-color: #2a1a0a; border-left: 4px solid #d4a72c; border-radius: 4px;">
              <p style="color: #f4c542; font-size: 14px; margin: 0; font-weight: 600;">
                ⚠️ Security Notice
              </p>
              <p style="color: #cccccc; font-size: 14px; line-height: 1.6; margin: 10px 0 0 0;">
                If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
              </p>
            </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px; background-color: #0a0a0a; border-top: 1px solid #2a2a2a;">
            <p style="color: #666; font-size: 12px; margin: 0;">
              For security reasons, never share your password with anyone. XNRT staff will never ask for your password.
            </p>
            <p style="color: #444; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
              © ${new Date().getFullYear()} NextGen Rise Foundation. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

export async function sendVerificationEmail(email: string, username: string, token: string): Promise<void> {
  const baseUrl = process.env.APP_URL || 'https://xnrt.org';
  
  const verificationLink = `${baseUrl}/verify-email?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: 'Verify Your Email - XNRT Platform',
    html: generateVerificationEmailHTML(username, verificationLink),
  });
}

export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<void> {
  const baseUrl = process.env.APP_URL || 'https://xnrt.org';
  
  const resetLink = `${baseUrl}/reset-password?token=${token}`;
  
  await sendEmail({
    to: email,
    subject: 'Reset Your Password - XNRT Platform',
    html: generatePasswordResetEmailHTML(username, resetLink),
  });
}
