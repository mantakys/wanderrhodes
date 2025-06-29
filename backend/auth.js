import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const TOKEN_BYTES = 32;
export const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

const JWT_SECRET = process.env.JWT_SECRET || 'development_secret_change_me';

export function generateMagicToken() {
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const expires = Date.now() + TOKEN_TTL_MS;
  return { token, hash, expires };
}

export function createJWT(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (_) {
    return null;
  }
} 
