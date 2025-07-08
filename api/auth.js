import crypto from 'crypto';
import { generateMagicToken, createJWT } from '../backend/auth.js';
import { upsertUser, setMagicToken, getUserByMagicToken, clearMagicToken } from '../backend/db-neon.js';
import { sendMagicLink, sendSignupConfirmation } from '../backend/email.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const DOMAIN = process.env.DOMAIN || (() => { console.error('❌ Missing DOMAIN'); process.exit(1); })();

export default async function handler(req, res) {
  const { action } = req.body || req.query;
  
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    switch (action) {
      case 'request-login':
        return await handleRequestLogin(req, res);
      case 'verify-login':
        return await handleVerifyLogin(req, res);
      case 'logout':
        return await handleLogout(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('🚨 Auth API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRequestLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const { token, hash, expires } = generateMagicToken();
  console.log('[Signup] Attempting to upsert user:', email);
  const user = await upsertUser(email.toLowerCase());
  await setMagicToken(email.toLowerCase(), hash, expires);

  // Send signup confirmation if this is a new user
  if (user && user.created_at && user.created_at === user.updated_at) {
    console.log('[Signup] Sending signup confirmation email to:', email);
    try {
      await sendSignupConfirmation(email);
      console.log('[Signup] Signup confirmation email sent to:', email);
    } catch (err) {
      console.error('[Signup] Error sending signup confirmation:', err);
    }
  }

  // Generate magic link URL (using HashRouter format)
  const frontendDomain = IS_PROD ? DOMAIN : 'http://localhost:5173';
  const link = `${frontendDomain}/#/login?token=${token}`;
  
  console.log(`🔗 [Login] Generated magic link: ${link}`);
  await sendMagicLink(email, link);
  
  return res.status(200).json({ success: true });
}

async function handleVerifyLogin(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.body;
  console.log('🔍 [Login] Received token verification request');
  
  if (!token) {
    console.log('❌ [Login] No token provided');
    return res.status(400).json({ error: 'Token is required' });
  }

  console.log('🔐 [Login] Hashing token for lookup...');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  console.log('🔍 [Login] Looking up user by token hash...');
  const user = await getUserByMagicToken(hash);
  
  if (!user) {
    console.log('❌ [Login] No user found with token hash');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  console.log(`✅ [Login] User found: ${user.email}`);
  console.log(`🔍 [Login] Raw token expires value: ${user.magic_token_expires} (type: ${typeof user.magic_token_expires})`);
  
  // Convert to number if it's a string (BigInt from PostgreSQL)
  const expiresTimestamp = typeof user.magic_token_expires === 'string' 
    ? parseInt(user.magic_token_expires, 10) 
    : user.magic_token_expires;
  
  console.log(`⏰ [Login] Token expires: ${new Date(expiresTimestamp)}, Current time: ${new Date()}`);
  
  if (!expiresTimestamp || expiresTimestamp < Date.now()) {
    console.log('❌ [Login] Token has expired or is invalid');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  console.log('🧹 [Login] Clearing magic token...');
  await clearMagicToken(user.email);
  
  console.log('🎫 [Login] Creating JWT...');
  const jwt = createJWT({ email: user.email });
  
  console.log('🍪 [Login] Setting JWT cookie using Set-Cookie header...');
  
  // Set cookie using Set-Cookie header (Vercel serverless compatible)
  const cookieOptions = [
    `jwt=${jwt}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${60 * 60 * 24 * 30}`, // 30 days
    'SameSite=Strict'
  ];
  
  if (IS_PROD) {
    cookieOptions.push('Secure');
  }
  
  res.setHeader('Set-Cookie', cookieOptions.join('; '));
  
  console.log(`✅ [Login] Login successful for ${user.email}`);
  return res.status(200).json({ success: true, jwt });
}

async function handleLogout(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear cookie using Set-Cookie header (Vercel serverless compatible)
  const clearCookieOptions = [
    'jwt=',
    'HttpOnly',
    'Path=/',
    'Max-Age=0', // Expire immediately
    'SameSite=Strict'
  ];
  
  if (IS_PROD) {
    clearCookieOptions.push('Secure');
  }
  
  res.setHeader('Set-Cookie', clearCookieOptions.join('; '));
  
  return res.status(200).json({ success: true });
} 