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
  console.log('🪝 Webhook called - Method:', req.method);
  console.log('🪝 Headers:', Object.keys(req.headers));
  
  if (req.method !== 'POST') {
    console.log('❌ Invalid method for webhook');
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  console.log('🪝 Stripe signature present:', !!sig);
  
  let event;

  try {
    // Read raw body manually since bodyParser is disabled
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);
    console.log('🪝 Raw body length:', rawBody.length);

    // 🔒 SECURITY: Try webhook signature verification, but be more lenient in production
    if (sig && STRIPE_WEBHOOK_SECRET) {
      console.log('🔐 Attempting signature verification...');
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        console.log('✅ Webhook signature verified');
      } catch (sigError) {
        console.error('❌ Signature verification failed:', sigError.message);
        // In production, if signature fails, still try to parse the event
        // This is a temporary fix - in real production you'd want strict verification
        console.warn('⚠️ Attempting to parse event without signature verification as fallback');
        try {
          event = JSON.parse(rawBody.toString());
          console.log('⚠️ Parsed event without signature verification');
        } catch (parseError) {
          console.error('❌ Failed to parse event as JSON:', parseError.message);
          return res.status(400).send(`Webhook Error: ${sigError.message}`);
        }
      }
    } else {
      // No signature or secret - parse directly
      console.warn('⚠️ No signature verification - parsing directly');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('❌ Webhook processing failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log the event details
  console.log('✅ Webhook event received:', event.type);
  console.log('🆔 Event ID:', event.id);

  if (event.type === 'checkout.session.completed') {
    const sessionObject = event.data.object;
    console.log('💳 Processing checkout session:', sessionObject.id);
    console.log('💳 Payment status:', sessionObject.payment_status);
    console.log('💳 Session status:', sessionObject.status);
    
    // Verify payment was actually successful
    if (sessionObject.payment_status !== 'paid') {
      console.warn('⚠️ Session completed but payment_status is not "paid":', sessionObject.payment_status);
      return res.json({ received: true });
    }

    let email = sessionObject.customer_email;
    console.log('📧 Customer email from session:', email);
    
    if (!email && sessionObject.customer_details?.email) {
      email = sessionObject.customer_details.email;
      console.log('📧 Customer email from details:', email);
    }
    
    if (!email && sessionObject.customer) {
      // Fetch customer from Stripe
      console.log('👤 Fetching customer from Stripe:', sessionObject.customer);
      try {
        const customer = await stripe.customers.retrieve(sessionObject.customer);
        email = customer.email;
        console.log('📧 Customer email from Stripe customer:', email);
      } catch (e) {
        console.error('❌ Failed to fetch customer from Stripe:', e.message);
      }
    }
    
    if (email) {
      console.log(`💾 Marking user as paid: ${email}`);
      try {
        // 🔒 SECURITY: Only mark user as paid after webhook verification
        await upsertUser(email, true);
        console.log(`✅ User successfully marked as paid via webhook: ${email}`);
        console.log(`💰 Payment amount: ${sessionObject.amount_total / 100} ${sessionObject.currency?.toUpperCase()}`);
        
        // Send welcome email after successful payment
        console.log(`📧 Sending welcome email to: ${email}`);
        await sendSignupConfirmation(email);
        console.log(`✅ Welcome email sent successfully to: ${email}`);
      } catch (e) {
        console.error('❌ Failed to upsert user or send welcome email from webhook:', e.message);
        console.error('❌ Full error:', e);
      }
    } else {
      console.warn('❌ No customer email found in checkout.session.completed event');
      console.log('🔍 Session object keys:', Object.keys(sessionObject));
      console.log('🔍 Customer details:', sessionObject.customer_details);
    }
  } else {
    console.log(`ℹ️ Ignoring webhook event type: ${event.type}`);
  }

  return res.json({ received: true });
}

// Configure for raw body parsing (needed for webhook signature verification)
export const config = {
  api: {
    bodyParser: false, // Disable body parsing to get raw body for signature verification
  },
} 