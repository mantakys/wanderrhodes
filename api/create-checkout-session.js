import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const IS_PROD = process.env.NODE_ENV === 'production';
const DOMAIN = process.env.DOMAIN || (() => { console.error('❌ Missing DOMAIN'); throw new Error('Missing DOMAIN'); })();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function pick(keyBase) {
  // const keyName = IS_PROD ? `${keyBase}_PROD` : `${keyBase}_TEST`;
  const keyName = `${keyBase}_TEST`;
  const val = process.env[keyName];
  if (!val) {
    console.error(`❌ Missing ${keyName} in your .env`);
    throw new Error(`Missing ${keyName}`);
  }
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

    if (!IS_PROD) {
      // Redirect flow in development
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${DOMAIN}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${DOMAIN}/paywall`,
        customer_email: userEmail,
      });
      return res.json({ url: session.url });
    }

    // Embedded flow in production
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      return_url: `${DOMAIN}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: userEmail,
    });
    
    return res.json({ clientSecret: session.client_secret });

  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    return res.status(500).json({ error: error.message || 'Stripe session failed' });
  }
} 