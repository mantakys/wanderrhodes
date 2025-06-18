// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import Stripe from 'stripe';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- OpenAI setup (if still used) ---
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Stripe setup ---
if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
  console.error('❌ Missing STRIPE keys or price ID');
  process.exit(1);
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15'
});

const DOMAIN = process.env.DOMAIN || 'http://localhost:5173';
const PRICE_ID = process.env.STRIPE_PRICE_ID;

console.log('✅ Stripe setup complete');
console.log('ℹ️ Using Price ID:', PRICE_ID);
console.log('ℹ️ Return URL:', `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`);

// --- Chat endpoint (unchanged if you're using OpenAI chat) ---
app.post('/api/chat', async (req, res) => {
  // your existing chat logic
});

// --- Create Embedded Checkout Session ---
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
          quantity: 1
        }
      ],
      return_url: `${DOMAIN}/return?session_id={CHECKOUT_SESSION_ID}`
    });

    console.log('✅ Created Stripe session:', session.id);
    res.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('❌ Error creating session:', err);
    res.status(500).json({ error: err.message || 'Stripe session failed' });
  }
});

// --- Retrieve Session Status for Return Page ---
app.get('/api/session-status', async (req, res) => {
  const session_id = req.query.session_id;
  if (!session_id) return res.status(400).json({ error: 'Missing session_id' });

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    res.json({
      status: session.status,
      customer_email: session.customer_details?.email || null
    });
  } catch (err) {
    console.error('❌ Error fetching session:', err);
    res.status(500).json({ error: err.message || 'Unable to retrieve session' });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
