// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import chatHandler from './chatHandler.js';
import agentHandler from './agentHandler.js';
import stepHandler from './stepHandler.js';
import guidedChatHandler from './guidedChatHandler.js';
import Stripe from 'stripe';
import mapboxDirectionsProxy from './tools/mapboxDirectionsProxy.js';
import axios from 'axios';
import { fetchPlacePhoto } from './tools/googlePlaces.js';
import { createJWT, generateMagicToken } from './auth.js';
import { 
  getUserByEmail, 
  getUserByMagicToken, 
  upsertUser, 
  setMagicToken, 
  clearMagicToken, 
  getAllUsers, 
  deleteUserByEmail,
  saveTravelPlan,
  getUserTravelPlans,
  deleteTravelPlan,
  updateTravelPlan,
  saveChatMessage,
  getUserChatHistory,
  clearUserChatHistory,
  saveUserPreferences,
  getUserPreferences
} from './db-adapter.js';
import { sendMagicLink, sendSignupConfirmation } from './email.js';
import { optionalAuth, requireAuth, requirePaidUser } from './middleware/auth.js';
import { chatGuard } from './middleware/chatGuard.js';
import crypto from 'crypto';
import bodyParser from 'body-parser';

dotenv.config();

const IS_PROD = process.env.NODE_ENV === 'production';
console.log(`🔧 Running in ${IS_PROD ? 'production' : 'development'} mode`);

function pick(keyBase) {
  // const keyName = IS_PROD ? `${keyBase}_PROD` : `${keyBase}_TEST`;
  const keyName = `${keyBase}_TEST`;
  // if (!val && IS_PROD) {
    // keyName = `${keyBase}_PROD`;
  // }
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

// Configuration flag for enabling the LangChain agent
const USE_LANGCHAIN_AGENT = process.env.USE_LANGCHAIN_AGENT === 'true' || false;

app.post('/api/chat', optionalAuth, chatGuard, USE_LANGCHAIN_AGENT ? agentHandler : chatHandler);
app.post('/api/agent', optionalAuth, chatGuard, agentHandler); // Direct access to agent
app.post('/api/poi-step', optionalAuth, chatGuard, stepHandler); // Step-by-step POI recommendations
app.post('/api/guided-chat', optionalAuth, chatGuard, guidedChatHandler); // Guided chat interface

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

  // Generate magic link URL (using HashRouter format)
  const frontendDomain = IS_PROD ? DOMAIN : 'http://localhost:5173';
  const link = `${frontendDomain}/#/login?token=${token}`;
  
  console.log(`🔗 [Login] Generated magic link: ${link}`);
  await sendMagicLink(email, link);
  res.json({ success: true });
});

app.post('/api/verify-login', async (req, res) => {
  const { token } = req.body;
  console.log('🔍 [Login] Received token verification request');
  
  if (!token) {
    console.log('❌ [Login] No token provided');
    return res.status(400).json({ error: 'Token is required' });
  }

  console.log('🔐 [Login] Hashing token for lookup...');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  
  console.log('🔍 [Login] Looking up user by token hash...');
  const user = getUserByMagicToken(hash);
  
  if (!user) {
    console.log('❌ [Login] No user found with token hash');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  console.log(`✅ [Login] User found: ${user.email}`);
  console.log(`⏰ [Login] Token expires: ${new Date(user.magic_token_expires)}, Current time: ${new Date()}`);
  
  if (user.magic_token_expires < Date.now()) {
    console.log('❌ [Login] Token has expired');
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  console.log('🧹 [Login] Clearing magic token...');
  clearMagicToken(user.email);
  
  console.log('🎫 [Login] Creating JWT...');
  const jwt = createJWT({ email: user.email });
  
  console.log('🍪 [Login] Setting JWT cookie...');
  res.cookie('jwt', jwt, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  
  console.log(`✅ [Login] Login successful for ${user.email}`);
  res.json({ success: true, jwt });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('jwt', {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict'
  });
  res.json({ success: true });
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
        success_url: `${DOMAIN}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
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
      return_url: `${DOMAIN}/api/payment-success?session_id={CHECKOUT_SESSION_ID}`,
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
    // 🔒 SECURITY FIX: Always verify with Stripe, even in development
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    // Only return limited information - payment status verification happens via webhook
    res.json({
      status: session.status,
      customer_email: session.customer_details?.email || session.customer_email || null,
      payment_status: session.payment_status || null,
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
    const { photoUrl, placeId } = await fetchPlacePhoto(query);
    if (!photoUrl && !placeId) return res.status(404).json({ error: 'No photo or place found' });
    res.json({ photoUrl, placeId });
  } catch (err) {
    console.error('Error in /api/place-photo:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
});

app.use('/api', mapboxDirectionsProxy);

if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 Backend running in development mode - admin routes enabled');
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
} else {
  console.log('🔧 Backend running in production mode - admin routes disabled');
  // Return 404 for admin routes in production
  app.get('/api/dev/users', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
  
  app.post('/api/admin/delete-user', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

// Stripe webhook endpoint
app.post('/api/stripe-webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // 🔒 SECURITY FIX: Verify webhook signature to prevent fake webhook calls
    if (IS_PROD && STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } else {
      // In development, parse without signature verification (for testing)
      console.warn('⚠️ Running in development mode - webhook signature verification disabled');
      if (Buffer.isBuffer(req.body)) {
        event = JSON.parse(req.body.toString());
      } else if (typeof req.body === 'object') {
        event = req.body;
      } else {
        throw new Error('Unexpected body type');
      }
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
        upsertUser(email, true);
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

  res.json({ received: true });
});

app.get('/api/me', optionalAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({
    user: {
      email: req.user.email,
      has_paid: req.user.has_paid,
      free_chats_used: req.user.free_chats_used,
      created_at: req.user.created_at,
      // add more fields as needed
    }
  });
});

// User data API endpoint for managing travel plans, preferences, and chat history
app.post('/api/user-data', requireAuth, (req, res) => {
  try {
    const { action, data } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;

    switch (action) {
      case 'save_travel_plan': {
        const { planData, planName } = data;
        if (!planData || !planName) {
          return res.status(400).json({ error: 'Missing plan data or name' });
        }

        const planId = saveTravelPlan(userId, planData, planName);
        console.log(`💾 Saved travel plan for user ${userEmail}: ${planName}`);
        
        return res.status(200).json({ 
          success: true, 
          planId,
          message: 'Travel plan saved successfully' 
        });
      }

      case 'get_travel_plans': {
        const plans = getUserTravelPlans(userId);
        console.log(`📋 Retrieved ${plans.length} travel plans for user ${userEmail}`);
        
        return res.status(200).json({ 
          success: true, 
          plans: plans.map(plan => ({
            id: plan.id,
            name: plan.plan_name,
            data: plan.plan_data,
            timestamp: plan.created_at * 1000, // Convert to milliseconds for compatibility
            createdAt: new Date(plan.created_at * 1000).toISOString(),
            updatedAt: new Date(plan.updated_at * 1000).toISOString()
          }))
        });
      }

      case 'delete_travel_plan': {
        const { planId } = data;
        if (!planId) {
          return res.status(400).json({ error: 'Missing plan ID' });
        }

        const result = deleteTravelPlan(userId, planId);
        if (result.changes > 0) {
          console.log(`🗑️ Deleted travel plan ${planId} for user ${userEmail}`);
          return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
        } else {
          return res.status(404).json({ error: 'Plan not found' });
        }
      }

      case 'update_travel_plan': {
        const { planId, planData, planName } = data;
        if (!planId || !planData || !planName) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = updateTravelPlan(userId, planId, planData, planName);
        if (result.changes > 0) {
          console.log(`✏️ Updated travel plan ${planId} for user ${userEmail}`);
          return res.status(200).json({ success: true, message: 'Plan updated successfully' });
        } else {
          return res.status(404).json({ error: 'Plan not found' });
        }
      }

      case 'save_chat_message': {
        const { sessionId, messageData } = data;
        if (!sessionId || !messageData) {
          return res.status(400).json({ error: 'Missing session ID or message data' });
        }

        saveChatMessage(userId, sessionId, messageData);
        console.log(`💬 Saved chat message for user ${userEmail}, session ${sessionId}`);
        
        return res.status(200).json({ success: true, message: 'Chat message saved' });
      }

      case 'get_chat_history': {
        const { sessionId } = data;
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing session ID' });
        }

        const messages = getUserChatHistory(userId, sessionId);
        console.log(`💬 Retrieved ${messages.length} chat messages for user ${userEmail}, session ${sessionId}`);
        
        return res.status(200).json({ 
          success: true, 
          messages: messages.map(msg => ({
            ...msg.message_data,
            timestamp: msg.created_at * 1000
          }))
        });
      }

      case 'clear_chat_history': {
        const { sessionId } = data;
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing session ID' });
        }

        const result = clearUserChatHistory(userId, sessionId);
        console.log(`🧹 Cleared chat history for user ${userEmail}, session ${sessionId}`);
        
        return res.status(200).json({ success: true, message: 'Chat history cleared' });
      }

      case 'save_preferences': {
        const { preferences } = data;
        if (!preferences) {
          return res.status(400).json({ error: 'Missing preferences data' });
        }

        saveUserPreferences(userId, preferences);
        console.log(`⚙️ Saved preferences for user ${userEmail}`);
        
        return res.status(200).json({ success: true, message: 'Preferences saved' });
      }

      case 'get_preferences': {
        const prefs = getUserPreferences(userId);
        console.log(`⚙️ Retrieved preferences for user ${userEmail}`);
        
        return res.status(200).json({ 
          success: true, 
          preferences: prefs?.preferences_data || null
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('🚨 User data API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Debug endpoint to check user status
app.get('/api/debug/user/:email', (req, res) => {
  const { email } = req.params;
  const user = getUserByEmail(email);
  if (user) {
    res.json({
      email: user.email,
      has_paid: user.has_paid,
      free_chats_used: user.free_chats_used,
      created_at: user.created_at,
    });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.get('/api/payment-success', async (req, res) => {
  const sessionId = req.query.session_id;
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id' });

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.status === 'complete') {
      // Get customer email from session
      let email = session.customer_email;
      if (!email && session.customer_details?.email) {
        email = session.customer_details.email;
      }
      if (!email && session.customer) {
        // Fetch customer from Stripe
        const customer = await stripe.customers.retrieve(session.customer);
        email = customer.email;
      }
      
      if (email) {
        // 🔒 SECURITY FIX: Only check if user is already marked as paid by webhook
        // DO NOT mark user as paid here - only webhook should do that
        const user = getUserByEmail(email);
        
        if (user && user.has_paid) {
          // User was properly verified by webhook - create JWT for authentication
          const jwt = createJWT({ email });
          
          // Set the JWT cookie
          res.cookie('jwt', jwt, {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'strict',
            maxAge: 1000 * 60 * 60 * 24 * 30,
          });
          
          // Redirect to clean homepage
          res.redirect('/');
          return;
        } else {
          // Session is complete but webhook hasn't processed payment yet
          // Redirect to a "processing" page that will check again
          console.warn(`⚠️ Session complete but user ${email} not marked as paid - webhook may not have processed yet`);
          res.redirect(`/payment-processing?session_id=${sessionId}`);
          return;
        }
      }
    }
    
    // If something went wrong, redirect to paywall
    console.warn('Payment success: session not complete or no email found');
    res.redirect('/paywall');
  } catch (err) {
    console.error('Payment success error:', err);
    res.redirect('/paywall');
  }
});

const PORT = process.env.PORT || 4242;
app.listen(PORT, () => {
  console.log(`🔌 API server listening on http://localhost:${PORT}`);
});
