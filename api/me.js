import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../backend/db-neon.js';
import { getCachedUserSession, cacheUserSession } from '../backend/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Debug: Log all cookies received
    console.log('🍪 [Me] All cookies received:', req.cookies);
    console.log('🍪 [Me] Raw Cookie header:', req.headers.cookie);
    
    const token = req.cookies?.jwt;
    
    if (!token) {
      console.log('❌ [Me] No JWT token found in cookies');
      return res.status(401).json({ error: 'No authentication token' });
    }

    console.log('🔍 [Me] JWT token found, verifying...');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ [Me] JWT verified for user:', decoded.email);
    
    // Try cache first
    let user = await getCachedUserSession(decoded.email);
    if (!user) {
      // Cache miss - fetch from database
      console.log('💾 [Me] Cache miss, fetching from database...');
      user = await getUserByEmail(decoded.email);
      if (user) {
        // Cache for future requests
        await cacheUserSession(decoded.email, user);
        console.log('✅ [Me] User cached for future requests');
      }
    } else {
      console.log('⚡ [Me] User data retrieved from cache');
    }
    
    if (!user) {
      console.log('❌ [Me] User not found in database:', decoded.email);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ [Me] Returning user data:', { email: user.email, has_paid: user.has_paid });
    return res.status(200).json({
      user: {
        email: user.email,
        has_paid: user.has_paid,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    console.error('🚨 Me API error:', error.message);
    console.error('🚨 Me API error details:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.log('❌ [Me] JWT verification failed:', error.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
} 