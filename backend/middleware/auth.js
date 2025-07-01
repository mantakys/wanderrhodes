import { verifyJWT } from '../auth.js';
import { getUserByEmail } from '../db.js';

function extractToken(req) {
  // Prefer Authorization header, fallback to cookie named "jwt"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return req.cookies?.jwt;
}

export function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) return next();
  const payload = verifyJWT(token);
  if (!payload || !payload.email) return next();
  const user = getUserByEmail(payload.email);
  if (!user) return next();
  req.user = user;
  next();
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  const payload = verifyJWT(token);
  if (!payload || !payload.email) return res.status(401).json({ error: 'Invalid token' });
  
  const user = getUserByEmail(payload.email);
  if (!user) return res.status(401).json({ error: 'User not found' });
  
  req.user = user;
  next();
}

export function requirePaidUser(req, res, next) {
  if (req.user && req.user.has_paid) return next();
  return res.status(402).json({ error: 'Payment required' });
} 
