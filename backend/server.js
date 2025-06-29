// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import chatHandler from './chatHandler.js';
import Stripe from 'stripe';
import mapboxDirectionsProxy from './tools/mapboxDirectionsProxy.js';
import axios from 'axios';
import { fetchPlacePhoto } from './tools/googlePlaces.js';
import { createJWT, generateMagicToken } from './auth.js';
import { getUserByEmail, upsertUser, setMagicToken, clearMagicToken, getAllUsers, deleteUserByEmail } from './db.js';
import { sendMagicLink, sendSignupConfirmation } from './email.js';
import { optionalAuth, requirePaidUser } from './middleware/auth.js';
import { chatGuard } from './middleware/chatGuard.js';
import crypto from 'crypto';
import bodyParser from 'body-parser';

dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';
console.log(`🔧 Running in ${IS_PROD ? 'production' : 'development'} mode`);

function pick(keyBase) {
  const keyName = IS_PROD ? `${keyBase}_PROD` : `${keyBase}_TEST`;
  const val = process.env[keyName];
  if (!val) {
    console.error(`❌ Missing ${keyName} in your .env`);
    process.exit(1);
  }
  return val;
}

const DOMAIN = process.env.DOMAIN || (() => { console.error('❌ Missing DOMAIN'); process.exit(1); })();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || (() => { console.error('❌ Missing OPENAI_API_KEY'); process.exit(1); })();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || null;

if (GOOGLE_MAPS_API_KEY) {
  console.log('✅ Google API Key for Places loaded.');
} else {
  console.warn('⚠️ GOOGLE_MAPS_API_KEY not set. Place-photo endpoint may fail.');
}

const STRIPE_SECRET_KEY     = pick('STRIPE_SECRET_KEY');
const STRIPE_PRICE_ID       = pick('STRIPE_PRICE_ID');
const STRIPE_WEBHOOK_SECRET = pick('STRIPE_WEBHOOK_SECRET');

console.log('ℹ️ Using Stripe Secret Key:', STRIPE_SECRET_KEY.slice(0, 8) + '…');
console.log('ℹ️ Using Price ID:', STRIPE_PRICE_ID);
console.log('ℹ️ Using Webhook Secret:', STRIPE_WEBHOOK_SECRET.slice(0, 8) + '…');

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.post('/api/chat', optionalAuth, chatGuard, chatHandler);

app.post('/api/request-login', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

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

  const link = `${DOMAIN}/login?token=${token}`;
  await sendMagicLink(email, link);
  res.json({ success: true });
});

app.post('/api/verify-login', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token is required' });

  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const user = getUserByEmail(hash);
  if (!user || user.magic_token_expires < Date.now()) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  clearMagicToken(user.email);
  const jwt = createJWT({ email: user.email });
  res.cookie('jwt', jwt, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  res.json({ success: true, jwt });
});

app.post('/api/create-checkout-session', optionalAuth, async (req, res) => {
  try {
  console.log('🔔 POST /api/create-checkout-session');

    if (!IS_PROD) {
      // Redirect flow in development
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
        success_url: `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${DOMAIN}/paywall`,
        customer_email: req.user?.email,
      });
      return res.json({ url: session.url });
    }

    // Embedded flow in production
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      return_url: `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: req.user?.email,
    });
    res.json({ clientSecret: session.client_secret });

  } catch (err) {
    console.error('❌ Error creating session:', err);
    res.status(500).json({ error: err.message || 'Stripe session failed' });
  }
});

app.get('/api/session-status', async (req, res) => {
  const session_id = req.query.session_id;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    if (!IS_PROD) {
      // Simulate complete in dev
      return res.json({ status: 'complete', customer_email: req.user?.email });
    }
    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.json({
      status: session.status,
      customer_email: session.customer_details?.email || null,
    });
  } catch (err) {
    console.error('❌ Error fetching session:', err);
    res.status(500).json({ error: err.message || 'Unable to retrieve session' });
  }
});

app.get('/api/photo-proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('Missing url');
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'WanderRhodes/1.0' },
    });
    res.set('Content-Type', resp.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public,max-age=86400');
    res.set('Access-Control-Allow-Origin', '*');
    res.send(resp.data);
  } catch (e) {
    console.error('Photo proxy error:', e.message);
    res.status(500).send('Failed to fetch image');
  }
});

app.get('/api/place-photo', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });
  try {
    const photoUrl = await fetchPlacePhoto(query);
    if (!photoUrl) return res.status(404).json({ error: 'No photo found' });
    res.json({ photoUrl });
  } catch (err) {
    console.error('Error in /api/place-photo:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

app.use('/api', mapboxDirectionsProxy);

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/dev/users', (req, res) => {
    const users = getAllUsers();
    res.json({ users });
  });

  app.post('/api/admin/delete-user', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    try {
      deleteUserByEmail(email);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

// Stripe webhook endpoint
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  let event;
  try {
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'object') {
      event = req.body;
    } else {
      throw new Error('Unexpected body type');
    }
  } catch (err) {
    console.error('Webhook error: invalid JSON', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Log the full event for debugging
  console.log('Received Stripe event:', JSON.stringify(event, null, 2));

  if (event.type === 'checkout.session.completed') {
    let email = event.data?.object?.customer_email;
    if (!email && event.data?.object?.customer_details?.email) {
      email = event.data.object.customer_details.email;
    }
    if (!email && event.data?.object?.customer) {
      // Fetch customer from Stripe
      try {
        const customer = await stripe.customers.retrieve(event.data.object.customer);
        email = customer.email;
      } catch (e) {
        console.error('Failed to fetch customer from Stripe:', e);
      }
    }
    if (email) {
      try {
        upsertUser(email, true);
        console.log(`✅ User marked as paid: ${email}`);
        // Send welcome email after successful payment
        await sendSignupConfirmation(email);
        console.log(`[Stripe] Signup confirmation email sent to: ${email}`);
      } catch (e) {
        console.error('Failed to upsert user or send welcome email from webhook:', e);
      }
    } else {
      console.warn('No customer_email found in checkout.session.completed event');
    }
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🔌 API server listening on http://localhost:${PORT}`);
});
