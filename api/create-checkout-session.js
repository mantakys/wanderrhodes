import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const IS_PROD = process.env.NODE_ENV === 'production';
const DOMAIN = process.env.DOMAIN || (() => { console.error('❌ Missing DOMAIN'); throw new Error('Missing DOMAIN'); })();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function pick(keyBase) {
  // For now, always use TEST keys until Vercel env vars are configured
  const keyName = `${keyBase}_TEST`;
  let val = process.env[keyName];
  
  // Fallback: try without _TEST suffix
  if (!val) {
    val = process.env[keyBase];
  }
  
  // Fallback: try _PROD suffix as last resort
  if (!val) {
    val = process.env[`${keyBase}_PROD`];
  }
  
  if (!val) {
    console.error(`❌ Missing environment variable. Tried: ${keyName}, ${keyBase}, ${keyBase}_PROD`);
    console.log('Available environment variables:', Object.keys(process.env).filter(key => key.includes('STRIPE')));
    throw new Error(`Missing ${keyName} environment variable`);
  }
  
  console.log(`✅ Using ${keyBase} from environment variable`);
  return val;
}

const STRIPE_SECRET_KEY = pick('STRIPE_SECRET_KEY');
const STRIPE_PRICE_ID = pick('STRIPE_PRICE_ID');
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('🔔 POST /api/create-checkout-session');

    // Optional auth - get user email if authenticated
    let userEmail = null;
    const token = req.cookies?.jwt;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        userEmail = decoded.email;
      } catch (err) {
        // Ignore auth errors for checkout
        console.log('No valid auth token for checkout');
      }
    }

    // Always use the simple redirect flow (safer for server-side environments like Vercel).
    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${DOMAIN}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/paywall`,
    };

    // Attach customer_email only if we actually have one to avoid "Invalid email" errors.
    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    return res.json({ url: session.url });

  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    return res.status(500).json({ error: error.message || 'Stripe session failed' });
  }
} 