import Stripe from 'stripe';

const IS_PROD = process.env.NODE_ENV === 'production';

function pick(keyBase) {
  const keyName = IS_PROD ? `${keyBase}_PROD` : `${keyBase}_TEST`;
  const val = process.env[keyName];
  if (!val) {
    console.error(`❌ Missing ${keyName} in your .env`);
    throw new Error(`Missing ${keyName}`);
  }
  return val;
}

const STRIPE_SECRET_KEY = pick('STRIPE_SECRET_KEY');
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const session_id = req.query.session_id;
    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    // 🔒 SECURITY FIX: Always verify with Stripe, even in development
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Only return limited information - payment status verification happens via webhook
    return res.status(200).json({
      status: session.status,
      customer_email: session.customer_details?.email || session.customer_email || null,
      payment_status: session.payment_status || null,
    });

  } catch (error) {
    console.error('❌ Error fetching session:', error.message);
    return res.status(500).json({ error: error.message || 'Unable to retrieve session' });
  }
} 