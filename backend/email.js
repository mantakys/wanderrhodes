import nodemailer from 'nodemailer';
import FormData from 'form-data';
import Mailgun from 'mailgun.js';
import dotenv from 'dotenv';

dotenv.config();

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

const mailgun = new Mailgun(FormData);
const mg = mailgun.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
  url: 'https://api.eu.mailgun.net', // <-- add this for EU domains
});

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

export async function sendSignupConfirmation(email, name = '') {
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.EMAIL_FROM || 'WanderRhodes <noreply@' + domain + '>';
  const subject = 'Welcome to WanderRhodes!';
  const text = `Hello${name ? ' ' + name : ''},\n\nThank you for signing up for WanderRhodes! Your account has been created successfully.\n\nHappy exploring!\n\nThe WanderRhodes Team`;
  const html = `<p>Hello${name ? ' ' + name : ''},</p><p>Thank you for signing up for <b>WanderRhodes</b>! Your account has been created successfully.</p><p>Happy exploring!<br/>The WanderRhodes Team</p>`;

  try {
    const result = await mg.messages.create(domain, {
      from,
      to: [email],
      subject,
      text,
      html,
    });
    console.log('✉️  Signup confirmation sent:', result.id);
  } catch (err) {
    console.error('Mailgun send error:', err);
    throw err;
  }
} 
