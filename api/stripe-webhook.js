import Stripe from 'stripe';
import { upsertUser } from '../backend/db-neon.js';
import { sendSignupConfirmation } from '../backend/email.js';

const IS_PROD = process.env.NODE_ENV === 'production';

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
    throw new Error(`Missing ${keyName} environment variable`);
  }
  
  return val;
}

const STRIPE_SECRET_KEY = pick('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = pick('STRIPE_WEBHOOK_SECRET');
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

console.log('ℹ️ Using Webhook Secret:', STRIPE_WEBHOOK_SECRET.slice(0, 8) + '…');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  // Read raw body manually since bodyParser is disabled
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const rawBody = Buffer.concat(chunks);

  try {
    // 🔒 SECURITY: Verify webhook signature to prevent fake webhook calls
    if (IS_PROD && STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // In development, parse without signature verification (for testing)
      console.warn('⚠️ Running in development mode - webhook signature verification disabled');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log the verified event
  console.log('✅ Verified Stripe webhook event:', event.type);

  if (event.type === 'checkout.session.completed') {
    const sessionObject = event.data.object;
    
    // Verify payment was actually successful
    if (sessionObject.payment_status !== 'paid') {
      console.warn('⚠️ Session completed but payment_status is not "paid":', sessionObject.payment_status);
      return res.json({ received: true });
    }

    let email = sessionObject.customer_email;
    if (!email && sessionObject.customer_details?.email) {
      email = sessionObject.customer_details.email;
    }
    if (!email && sessionObject.customer) {
      // Fetch customer from Stripe
      try {
        const customer = await stripe.customers.retrieve(sessionObject.customer);
        email = customer.email;
      } catch (e) {
        console.error('Failed to fetch customer from Stripe:', e);
      }
    }
    
    if (email) {
      try {
        // 🔒 SECURITY: Only mark user as paid after webhook verification
        await upsertUser(email, true);
        console.log(`✅ User marked as paid via webhook: ${email}`);
        console.log(`💰 Payment amount: ${sessionObject.amount_total / 100} ${sessionObject.currency?.toUpperCase()}`);
        
        // Send welcome email after successful payment
        await sendSignupConfirmation(email);
        console.log(`📧 Signup confirmation email sent to: ${email}`);
      } catch (e) {
        console.error('❌ Failed to upsert user or send welcome email from webhook:', e);
      }
    } else {
      console.warn('❌ No customer email found in checkout.session.completed event');
    }
  }

  return res.json({ received: true });
}

// Configure for raw body parsing (needed for webhook signature verification)
export const config = {
  api: {
    bodyParser: false, // Disable body parsing to get raw body for signature verification
  },
} 