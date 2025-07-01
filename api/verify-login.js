import crypto from 'crypto';
import { createJWT } from '../backend/auth.js';
import { getUserByMagicToken, clearMagicToken } from '../backend/db.js';

const IS_PROD = process.env.NODE_ENV === 'production';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body;
    console.log('🔍 [Login] Received token verification request');
    
    if (!token) {
      console.log('❌ [Login] No token provided');
      return res.status(400).json({ error: 'Token is required' });
    }

    console.log('🔐 [Login] Hashing token for lookup...');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    
    console.log('🔍 [Login] Looking up user by token hash...');
    const user = getUserByMagicToken(hash);
    
    if (!user) {
      console.log('❌ [Login] No user found with token hash');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    console.log(`✅ [Login] User found: ${user.email}`);
    console.log(`⏰ [Login] Token expires: ${new Date(user.magic_token_expires)}, Current time: ${new Date()}`);
    
    if (user.magic_token_expires < Date.now()) {
      console.log('❌ [Login] Token has expired');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('🧹 [Login] Clearing magic token...');
    clearMagicToken(user.email);
    
    console.log('🎫 [Login] Creating JWT...');
    const jwt = createJWT({ email: user.email });
    
    console.log('🍪 [Login] Setting JWT cookie...');
    res.cookie('jwt', jwt, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });
    
    console.log(`✅ [Login] Login successful for ${user.email}`);
    return res.status(200).json({ success: true, jwt });

  } catch (error) {
    console.error('🚨 Verify login API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 