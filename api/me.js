import jwt from 'jsonwebtoken';
import { getUserByEmail } from '../backend/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.cookies?.jwt;
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.status(200).json({
      email: user.email,
      has_paid: user.has_paid,
      created_at: user.created_at,
      updated_at: user.updated_at
    });

  } catch (error) {
    console.error('🚨 Me API error:', error.message);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
} 