import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../backend/db-neon.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' });

function createJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query.session_id;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    console.log('🎉 Processing payment success for session:', sessionId);
    
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
        console.log('🔍 Checking payment status for email:', email);
        
        // 🔒 SECURITY: Only check if user is already marked as paid by webhook
        // DO NOT mark user as paid here - only webhook should do that
        const user = await getUserByEmail(email);
        
        if (user && user.has_paid) {
          console.log('✅ User verified as paid, creating session');
          
          // User was properly verified by webhook - create JWT for authentication
          const jwtToken = createJWT({ email });
          
          // Set the JWT cookie
          res.setHeader('Set-Cookie', [
            `jwt=${jwtToken}; HttpOnly; ${IS_PROD ? 'Secure;' : ''} SameSite=Strict; Max-Age=${30 * 24 * 60 * 60}; Path=/`
          ]);
          
          // Redirect to clean homepage
          return res.redirect(302, '/');
        } else {
          // Session is complete but webhook hasn't processed payment yet
          // Redirect to a "processing" page that will check again
          console.warn(`⚠️ Session complete but user ${email} not marked as paid - webhook may not have processed yet`);
          return res.redirect(302, `/payment-processing?session_id=${sessionId}`);
        }
      } else {
        console.warn('⚠️ No email found in session');
      }
    } else {
      console.warn('⚠️ Session not complete, status:', session.status);
    }
    
    // If something went wrong, redirect to paywall
    console.warn('Payment success: session not complete or no email found');
    return res.redirect(302, '/paywall');
    
  } catch (error) {
    console.error('❌ Payment success error:', error.message);
    return res.redirect(302, '/paywall');
  }
} 