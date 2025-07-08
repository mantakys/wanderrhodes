import Stripe from 'stripe';

const IS_PROD = process.env.NODE_ENV === 'production';
let DOMAIN = process.env.DOMAIN;

// Fallback to the request origin in production if DOMAIN is not set
if (!DOMAIN && typeof window === 'undefined') {
  // This will be replaced per request below using req.headers
  DOMAIN = null;
}

function sanitizeDomain(input) {
  if (!input) return null;
  let url = input.trim();
  // Prepend https:// if protocol is missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  // Remove trailing slash
  url = url.replace(/\/+$/, '');
  return url;
}

// Sanitize once if we already have the env var
DOMAIN = sanitizeDomain(DOMAIN);

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
    console.log('📧 Request body:', req.body);

    // Extract customer email from request body
    const { email } = req.body;
    
    // If DOMAIN was not provided via env, fall back to req.headers.origin
    let baseUrl = DOMAIN;
    if (!baseUrl) {
      const originHeader = req.headers['origin'] || `https://${req.headers['host']}`;
      baseUrl = sanitizeDomain(originHeader);
    }

    if (!baseUrl) {
      throw new Error('Unable to determine base URL for success/cancel redirect');
    }

    console.log('🌐 Using base URL:', baseUrl);
    console.log('📧 Customer email:', email || 'Not provided');

    // Create checkout session with customer email
    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${baseUrl}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/paywall`,
      // Always ensure customer creation for better tracking
      customer_creation: 'always',
      // Include customer email if provided
      ...(email && { customer_email: email }),
      // Always collect billing address for better customer data
      billing_address_collection: 'required',
      // Ensure customer is created and linked to payment intent
      ...(email && {
        customer_email: email,
      }),
      // Enable automatic tax calculation
      automatic_tax: { enabled: false }, // Set to true if you want tax calculation
      // Add metadata for tracking
      metadata: {
        source: 'wanderrhodes_paywall',
        timestamp: new Date().toISOString(),
        customer_email: email || 'collected_at_checkout'
      },
      // Add custom fields for better customer data
      custom_fields: [],
      // Ensure payment intent gets customer info
      payment_intent_data: {
        ...(email && { receipt_email: email }),
        metadata: {
          source: 'wanderrhodes_paywall',
          customer_email: email || 'collected_at_checkout'
        }
      }
    };

    console.log('📋 Session params:', JSON.stringify(sessionParams, null, 2));

    const session = await stripe.checkout.sessions.create(sessionParams);
    console.log('✅ Session created:', session.id);
    
    return res.json({ url: session.url });

  } catch (error) {
    console.error('❌ Error creating session:', error.message);
    console.error('❌ Full error:', error);
    return res.status(500).json({ error: error.message || 'Stripe session failed' });
  }
} 