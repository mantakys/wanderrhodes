import nodemailer from 'nodemailer';

const hasSmtp = Boolean(process.env.SMTP_HOST);

let transporter = null;
if (hasSmtp) {
  // Configure transporter from environment variables
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: process.env.SMTP_USER ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

export async function sendMagicLink(email, link) {
  if (!hasSmtp) {
    console.log(`🔗 [DEV] Magic login link for ${email}: ${link}`);
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'no-reply@wanderrhodes.com',
    to: email,
    subject: 'Your WanderRhodes Login Link',
    text: `Click the following link to log in. It expires in 15 minutes: ${link}`,
    html: `<p>Click <a href="${link}">this link</a> to log in. It expires in 15 minutes.</p>`
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('✉️  Magic link sent %s', info.messageId);
} 
