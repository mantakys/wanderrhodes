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
  const domain = process.env.MAILGUN_DOMAIN;
  
  // Fallback to console in development if Mailgun isn't configured
  if (!domain || !process.env.MAILGUN_API_KEY) {
    console.log(`🔗 [DEV] Magic login link for ${email}: ${link}`);
    return;
  }

  // Construct a valid "from" email address
  let from;
  if (process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@')) {
    from = process.env.EMAIL_FROM;
  } else {
    from = `noreply@${domain}`;
  }
  
  console.log(`📧 Sending magic link from: ${from} to: ${email}`);
  
  const subject = 'Your WanderRhodes Login Link ✨';
  const text = `Hello!\n\nClick the following link to log in to your WanderRhodes account. This link expires in 15 minutes for security.\n\n${link}\n\nIf you didn't request this login link, you can safely ignore this email.\n\nHappy exploring!\nThe WanderRhodes Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #E8D5A4; text-align: center;">🏛️ WanderRhodes</h2>
      <div style="background: linear-gradient(135deg, #1a1f3d 0%, #242b50 100%); color: white; padding: 30px; border-radius: 15px; text-align: center;">
        <h3 style="color: #E8D5A4; margin-bottom: 20px;">Your Login Link is Ready! ✨</h3>
        <p style="margin-bottom: 25px; line-height: 1.6;">Click the button below to securely log in to your WanderRhodes account.</p>
        <a href="${link}" style="display: inline-block; background: linear-gradient(45deg, #E8D5A4, #B89E6A); color: #1a1f3d; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0;">
          🚀 Log In to WanderRhodes
        </a>
        <p style="margin-top: 25px; font-size: 14px; color: #cccccc;">This link expires in 15 minutes for your security.</p>
        <p style="font-size: 12px; color: #999999; margin-top: 20px;">If you didn't request this login link, you can safely ignore this email.</p>
      </div>
      <p style="text-align: center; margin-top: 20px; color: #666666; font-size: 12px;">Happy exploring! 🌴<br/>The WanderRhodes Team</p>
    </div>
  `;

  try {
    const result = await mg.messages.create(domain, {
      from,
      to: [email],
      subject,
      text,
      html,
    });
    console.log('✉️  Magic link sent:', result.id);
  } catch (err) {
    console.error('Mailgun magic link send error:', err);
    throw err;
  }
}

export async function sendSignupConfirmation(email, name = '') {
  const domain = process.env.MAILGUN_DOMAIN;
  
  // Construct a valid "from" email address (same as magic link)
  let from;
  if (process.env.EMAIL_FROM && process.env.EMAIL_FROM.includes('@')) {
    from = process.env.EMAIL_FROM;
  } else {
    from = `noreply@${domain}`;
  }
  
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
