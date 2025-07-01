import { generateMagicToken } from '../backend/auth.js';
import { upsertUser, setMagicToken } from '../backend/db-neon.js';
import { sendMagicLink, sendSignupConfirmation } from '../backend/email.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const DOMAIN = process.env.DOMAIN || (() => { console.error('❌ Missing DOMAIN'); process.exit(1); })();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const { token, hash, expires } = generateMagicToken();
    console.log('[Signup] Attempting to upsert user:', email);
    const user = upsertUser(email.toLowerCase());
    setMagicToken(email.toLowerCase(), hash, expires);

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

  } catch (error) {
    console.error('🚨 Request login API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 