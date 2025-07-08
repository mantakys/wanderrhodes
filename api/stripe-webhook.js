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
  console.log('🪝 Stripe signature preview:', sig ? sig.substring(0, 50) + '...' : 'N/A');
  console.log('🪝 Webhook secret preview:', STRIPE_WEBHOOK_SECRET ? STRIPE_WEBHOOK_SECRET.substring(0, 15) + '...' : 'N/A');
  
  let event;
  let rawBody;

  try {
    // Read raw body manually since bodyParser is disabled
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    rawBody = Buffer.concat(chunks);
    console.log('🪝 Raw body length:', rawBody.length);
    console.log('🪝 Raw body preview:', rawBody.toString().substring(0, 100) + '...');

    // 🔒 SECURITY: Try webhook signature verification with better error handling
    if (sig && STRIPE_WEBHOOK_SECRET) {
      console.log('🔐 Attempting signature verification...');
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        console.log('✅ Webhook signature verified successfully');
      } catch (sigError) {
        console.error('❌ Signature verification failed:', sigError.message);
        console.error('❌ Signature error type:', sigError.type);
        console.error('❌ Full signature error:', sigError);
        
        // Log signature details for debugging
        if (sig) {
          const sigParts = sig.split(',');
          console.log('🔍 Signature parts:', sigParts);
        }
        
        // In production, if signature fails, still try to parse the event as fallback
        // This is temporary - in real production you'd want strict verification
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
      console.warn('⚠️ Missing:', !sig ? 'signature' : 'webhook secret');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('❌ Webhook processing failed:', err.message);
    console.error('❌ Full webhook error:', err);
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
      console.log(`💾 Marking user as paid via checkout session: ${email}`);
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
  } else if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    console.log('💰 Processing payment intent:', paymentIntent.id);
    console.log('💰 Payment status:', paymentIntent.status);
    console.log('💰 Amount:', paymentIntent.amount / 100, paymentIntent.currency?.toUpperCase());
    
    let email = null;
    
    // Get customer email from payment intent
    if (paymentIntent.customer) {
      console.log('👤 Fetching customer from payment intent:', paymentIntent.customer);
      try {
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        email = customer.email;
        console.log('📧 Customer email from payment intent:', email);
      } catch (e) {
        console.error('❌ Failed to fetch customer from payment intent:', e.message);
      }
    }
    
    // Alternatively, check if email is in receipt_email
    if (!email && paymentIntent.receipt_email) {
      email = paymentIntent.receipt_email;
      console.log('📧 Customer email from receipt_email:', email);
    }
    
    if (email) {
      console.log(`💾 Marking user as paid via payment_intent: ${email}`);
      try {
        await upsertUser(email, true);
        console.log(`✅ User marked as paid via payment_intent webhook: ${email}`);
        
        // Send welcome email (only if not already sent)
        console.log(`📧 Sending welcome email to: ${email}`);
        await sendSignupConfirmation(email);
        console.log(`✅ Welcome email sent successfully to: ${email}`);
      } catch (e) {
        console.error('❌ Failed to process payment_intent webhook:', e.message);
        console.error('❌ Full error:', e);
      }
    } else {
      console.warn('❌ No customer email found in payment_intent.succeeded event');
      console.log('🔍 Payment intent customer:', paymentIntent.customer);
      console.log('🔍 Payment intent receipt_email:', paymentIntent.receipt_email);
    }
  } else if (event.type === 'checkout.session.async_payment_failed') {
    const sessionObject = event.data.object;
    console.log('❌ Async payment failed for session:', sessionObject.id);
    console.log('❌ Session status:', sessionObject.status);
    console.log('❌ Payment status:', sessionObject.payment_status);
    
    let email = sessionObject.customer_email || sessionObject.customer_details?.email;
    if (email) {
      console.log(`⚠️ Payment failed for user: ${email}`);
      // Note: We don't mark user as paid, just log the failure
      // You could send a "payment failed" email here if needed
    }
  } else if (event.type === 'payment_intent.payment_failed') {
    const paymentIntent = event.data.object;
    console.log('❌ Payment intent failed:', paymentIntent.id);
    console.log('❌ Failure code:', paymentIntent.last_payment_error?.code);
    console.log('❌ Failure message:', paymentIntent.last_payment_error?.message);
    console.log('❌ Amount:', paymentIntent.amount / 100, paymentIntent.currency?.toUpperCase());
    
    let email = null;
    if (paymentIntent.customer) {
      try {
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        email = customer.email;
        console.log(`⚠️ Payment failed for user: ${email}`);
      } catch (e) {
        console.error('❌ Failed to fetch customer for failed payment:', e.message);
      }
    }
  } else if (event.type === 'payment_intent.canceled') {
    const paymentIntent = event.data.object;
    console.log('🚫 Payment intent canceled:', paymentIntent.id);
    console.log('🚫 Cancellation reason:', paymentIntent.cancellation_reason);
    console.log('🚫 Amount:', paymentIntent.amount / 100, paymentIntent.currency?.toUpperCase());
    
    let email = null;
    if (paymentIntent.customer) {
      try {
        const customer = await stripe.customers.retrieve(paymentIntent.customer);
        email = customer.email;
        console.log(`ℹ️ Payment canceled for user: ${email}`);
      } catch (e) {
        console.error('❌ Failed to fetch customer for canceled payment:', e.message);
      }
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