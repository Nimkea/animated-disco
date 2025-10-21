const BRAND_COLOR = '#D4AF37';
const BRAND_NAME = 'XNRT';
const BRAND_TAGLINE = 'We Build the NextGen';

function getBaseTemplate(content: string, preheader?: string): string {
  return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <title>${BRAND_NAME}</title>
  ${preheader ? `<div style="display:none;font-size:1px;color:#fefefe;line-height:1px;font-family:Arial,sans-serif;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}
  <style>
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      border-collapse: collapse;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    p {
      display: block;
      margin: 13px 0;
    }
  </style>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="background-color: #000000; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <center style="width: 100%; background-color: #000000;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000;">
      <tr>
        <td align="center" style="padding: 40px 10px 40px 10px;">
          <!-- Main Container -->
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px;">
            <!-- Header -->
            <tr>
              <td align="center" style="padding: 40px 40px 20px 40px; background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,0,0,0.95) 100%); border-radius: 8px 8px 0 0;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <h1 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 36px; font-weight: 700; color: ${BRAND_COLOR}; margin: 0; letter-spacing: 1px;">
                        ${BRAND_NAME}
                      </h1>
                      <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 14px; color: ${BRAND_COLOR}; margin: 8px 0 0 0; opacity: 0.9;">
                        ${BRAND_TAGLINE}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Content -->
            <tr>
              <td align="center" style="padding: 40px 40px 40px 40px; background-color: #0a0a0a; border-left: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a;">
                ${content}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td align="center" style="padding: 30px 40px 40px 40px; background-color: #050505; border-radius: 0 0 8px 8px; border-left: 1px solid #1a1a1a; border-right: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #666666; margin: 0; line-height: 18px;">
                        © ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
                      </p>
                      <p style="font-family: Arial, sans-serif; font-size: 12px; color: #666666; margin: 10px 0 0 0; line-height: 18px;">
                        Off-chain gamification earning platform
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `.trim();
}

function createButton(text: string, url: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="border-radius: 6px; background-color: ${BRAND_COLOR};">
                <a href="${url}" target="_blank" style="font-size: 16px; font-family: 'Space Grotesk', Arial, sans-serif; font-weight: 600; color: #000000; text-decoration: none; display: inline-block; padding: 14px 40px; border-radius: 6px; letter-spacing: 0.5px;">
                  ${text}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function createInfoBox(title: string, value: string, icon?: string): string {
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0; background-color: #151515; border: 1px solid #252525; border-radius: 6px;">
      <tr>
        <td style="padding: 20px;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <p style="font-family: Arial, sans-serif; font-size: 13px; color: #999999; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  ${icon ? icon + ' ' : ''}${title}
                </p>
                <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0;">
                  ${value}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function generateVerificationEmail(email: string, token: string, baseUrl: string): string {
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            Verify Your Email Address
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 20px 0; line-height: 24px;">
            Welcome to ${BRAND_NAME}! Please verify your email address to activate your account and start earning XNRT tokens.
          </p>
          ${createButton('Verify Email Address', verifyUrl)}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 20px 0 0 0; line-height: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-family: monospace; font-size: 12px; color: ${BRAND_COLOR}; margin: 10px 0 0 0; word-break: break-all;">
            ${verifyUrl}
          </p>
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            This link will expire in 24 hours for security reasons. If you didn't create an account with ${BRAND_NAME}, you can safely ignore this email.
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, 'Please verify your email address to activate your XNRT account');
}

export function generatePasswordResetEmail(email: string, token: string, baseUrl: string): string {
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            Reset Your Password
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 20px 0; line-height: 24px;">
            We received a request to reset the password for your ${BRAND_NAME} account. Click the button below to set a new password.
          </p>
          ${createButton('Reset Password', resetUrl)}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 20px 0 0 0; line-height: 20px;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-family: monospace; font-size: 12px; color: ${BRAND_COLOR}; margin: 10px 0 0 0; word-break: break-all;">
            ${resetUrl}
          </p>
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            This link will expire in 1 hour for security reasons. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, 'Reset your XNRT account password');
}

export function generateDepositConfirmationEmail(
  email: string,
  amount: number,
  xnrtAmount: number,
  txHash: string,
  confirmations: number
): string {
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            🎉 Deposit Confirmed!
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 25px 0; line-height: 24px;">
            Great news! Your USDT deposit has been confirmed and credited to your ${BRAND_NAME} account.
          </p>
          ${createInfoBox('💰 USDT Deposited', `${amount.toFixed(2)} USDT`, '💰')}
          ${createInfoBox('✨ XNRT Received', `${xnrtAmount.toLocaleString()} XNRT`, '✨')}
          ${createInfoBox('🔗 Transaction Hash', txHash.substring(0, 20) + '...', '🔗')}
          ${createInfoBox('✅ Confirmations', `${confirmations}/12 Confirmed`, '✅')}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 25px 0 0 0; line-height: 20px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            Your XNRT tokens are now available in your account. Start earning more through staking, mining, and referrals!
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, `Your ${amount} USDT deposit has been confirmed`);
}

export function generateWithdrawalNotificationEmail(
  email: string,
  amount: number,
  usdtAmount: number,
  status: 'pending' | 'approved' | 'rejected',
  walletAddress?: string
): string {
  const statusEmoji = status === 'approved' ? '✅' : status === 'rejected' ? '❌' : '⏳';
  const statusText = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
  const statusColor = status === 'approved' ? '#4ade80' : status === 'rejected' ? '#ef4444' : '#fbbf24';
  
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            ${statusEmoji} Withdrawal ${statusText}
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 25px 0; line-height: 24px;">
            ${status === 'pending' 
              ? 'Your withdrawal request has been submitted and is currently under review.'
              : status === 'approved'
              ? 'Your withdrawal has been approved and processed!'
              : 'Your withdrawal request has been rejected. Please contact support for more information.'}
          </p>
          ${createInfoBox('💎 XNRT Amount', `${amount.toLocaleString()} XNRT`, '💎')}
          ${createInfoBox('💵 USDT Value', `${usdtAmount.toFixed(2)} USDT`, '💵')}
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 15px 0; background-color: #151515; border: 1px solid #252525; border-radius: 6px;">
            <tr>
              <td style="padding: 20px;">
                <p style="font-family: Arial, sans-serif; font-size: 13px; color: #999999; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px;">
                  📊 STATUS
                </p>
                <p style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 600; color: ${statusColor}; margin: 0;">
                  ${statusEmoji} ${statusText}
                </p>
              </td>
            </tr>
          </table>
          ${walletAddress ? createInfoBox('🏦 Wallet Address', walletAddress.substring(0, 20) + '...', '🏦') : ''}
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            ${status === 'pending'
              ? 'You will receive another email once your withdrawal has been reviewed.'
              : status === 'approved'
              ? 'The USDT has been sent to your wallet address. Please allow a few minutes for the transaction to appear on the blockchain.'
              : 'If you believe this was an error, please contact our support team.'}
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, `Withdrawal ${statusText}: ${amount.toLocaleString()} XNRT`);
}

export function generateAchievementUnlockEmail(
  email: string,
  achievementName: string,
  achievementDescription: string,
  xpReward: number
): string {
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 10px 0;">
            🏆 Achievement Unlocked!
          </h2>
          <h3 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 28px; font-weight: 700; color: ${BRAND_COLOR}; margin: 0 0 20px 0; letter-spacing: 0.5px;">
            ${achievementName}
          </h3>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 25px 0; line-height: 24px;">
            ${achievementDescription}
          </p>
          ${createInfoBox('⭐ XP Reward', `+${xpReward} XP`, '⭐')}
          <p style="font-family: Arial, sans-serif; font-size: 14px; color: #999999; margin: 25px 0 0 0; line-height: 20px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            Keep going! Complete more tasks and unlock even more achievements to climb the leaderboard.
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, `Achievement Unlocked: ${achievementName}`);
}

export function generateWelcomeEmail(email: string, username: string, baseUrl: string): string {
  const loginUrl = `${baseUrl}/auth`;
  
  const content = `
    <table border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td>
          <h2 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff; margin: 0 0 20px 0;">
            Welcome to ${BRAND_NAME}, ${username}! 🎉
          </h2>
          <p style="font-family: Arial, sans-serif; font-size: 16px; color: #cccccc; margin: 0 0 20px 0; line-height: 24px;">
            Your account is now verified and ready to go! Start earning XNRT tokens through our powerful earning mechanisms.
          </p>
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 25px 0; background: linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(0,0,0,0.5) 100%); border: 1px solid rgba(212,175,55,0.3); border-radius: 8px;">
            <tr>
              <td style="padding: 25px 20px;">
                <h3 style="font-family: 'Space Grotesk', Arial, sans-serif; font-size: 18px; font-weight: 600; color: ${BRAND_COLOR}; margin: 0 0 15px 0;">
                  🚀 Ways to Earn XNRT
                </h3>
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="font-family: Arial, sans-serif; font-size: 14px; color: #cccccc; margin: 0; line-height: 20px;">
                        <strong style="color: ${BRAND_COLOR};">💎 Staking:</strong> Stake XNRT and earn up to 730% APY
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="font-family: Arial, sans-serif; font-size: 14px; color: #cccccc; margin: 0; line-height: 20px;">
                        <strong style="color: ${BRAND_COLOR};">⛏️ Mining:</strong> Run 24-hour mining sessions and convert XP to XNRT
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="font-family: Arial, sans-serif; font-size: 14px; color: #cccccc; margin: 0; line-height: 20px;">
                        <strong style="color: ${BRAND_COLOR};">👥 Referrals:</strong> Build a 3-level network and earn commissions
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0;">
                      <p style="font-family: Arial, sans-serif; font-size: 14px; color: #cccccc; margin: 0; line-height: 20px;">
                        <strong style="color: ${BRAND_COLOR};">✅ Daily Tasks:</strong> Complete tasks and maintain streaks
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${createButton('Start Earning Now', loginUrl)}
          <p style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; margin: 25px 0 0 0; line-height: 18px; padding-top: 20px; border-top: 1px solid #1a1a1a;">
            Need help? Check out our FAQ or reach out to our support team. We're here to help you maximize your earnings!
          </p>
        </td>
      </tr>
    </table>
  `;
  
  return getBaseTemplate(content, `Welcome to ${BRAND_NAME} - Start earning XNRT tokens today!`);
}
