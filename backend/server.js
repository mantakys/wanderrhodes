// Local development Express server used to mirror the serverless function
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import chatHandler from './chatHandler.js';
import Stripe from 'stripe';
import mapboxDirectionsProxy from './tools/mapboxDirectionsProxy.js';
import axios from 'axios';
import { fetchPlacePhoto } from './tools/googlePlaces.js';

dotenv.config();

// Debug: Check if Google API key is loaded
if (process.env.GOOGLE_MAPS_API_KEY) {
  console.log('✅ Google API Key for Places loaded successfully.');
} else {
  console.error('❌ GOOGLE_MAPS_API_KEY not found. Make sure it is set in your .env file.');
}

const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}

// ----------------- Stripe Setup -----------------
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
  console.error('❌ Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID');
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

const DOMAIN = process.env.DOMAIN || 'http://localhost:5173';
const PRICE_ID = process.env.STRIPE_PRICE_ID;

console.log('✅ Stripe setup complete');
console.log('ℹ️ Using Price ID:', PRICE_ID);
console.log('ℹ️ Return URL:', `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`);

// Mount the same handler as used by the serverless function
app.post('/api/chat', chatHandler);

// ----------------- Stripe Endpoints -----------------

// Create Embedded Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  console.log('🔔 POST /api/create-checkout-session');
  try {
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      return_url: `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`,
    });

    console.log('✅ Created Stripe session:', session.id);
    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('❌ Error creating session:', err);
    res.status(500).json({ error: err.message || 'Stripe session failed' });
  }
});

// Retrieve Session Status for Return Page
app.get('/api/session-status', async (req, res) => {
  const session_id = req.query.session_id;
  if (!session_id) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
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

// Proxy image to avoid API key referrer issues
app.get('/api/photo-proxy', async (req, res) => {
  const url = req.query.url;
  console.log('🖼️ Proxy fetching image:', url);
  if (!url) return res.status(400).send('Missing url');
  try {
    const resp = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'WanderRhodes/1.0 (https://wanderrhodes.com)'
      }
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

// Add /api/place-photo endpoint
app.get('/api/place-photo', async (req, res) => {
  const query = req.query.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  try {
    const photoUrl = await fetchPlacePhoto(query);
    if (!photoUrl) {
      return res.status(404).json({ error: 'No photo found' });
    }
    res.json({ photoUrl });
  } catch (err) {
    console.error('Error in /api/place-photo:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

// Mount Mapbox directions proxy
app.use('/api', mapboxDirectionsProxy);

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🔌 API server listening on http://localhost:${PORT}`);
});
