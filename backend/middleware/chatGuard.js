import { incrementFreeChats, upsertUser } from '../db.js';
import { requirePaidUser } from './auth.js';

// In-memory fallback for guests identified by IP
const ipUsage = new Map();
const FREE_CHATS_ALLOWED = 5;

export function chatGuard(req, res, next) {
  if (req.user) {
    // If logged in user has paid, allow. Else fallback to free usage count in DB
    if (req.user.has_paid) return next();
    if (req.user.free_chats_used < FREE_CHATS_ALLOWED) {
      incrementFreeChats(req.user.email);
      return next();
    }
    return res.status(402).json({ error: 'Free usage exhausted – please complete payment.' });
  }

  // Guest flow – track by IP to allow exactly 5 requests
  const ip = req.ip;
  const used = ipUsage.get(ip) || 0;
  if (used < FREE_CHATS_ALLOWED) {
    ipUsage.set(ip, used + 1);
    return next();
  }
  return res.status(402).json({ error: 'Free usage exhausted – please complete payment.' });
} 
