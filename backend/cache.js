import { Redis } from '@upstash/redis';

// Redis client (Upstash for serverless)
const redis = process.env.UPSTASH_REDIS_REST_URL ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;

const CACHE_TTL = {
  USER_SESSION: 60 * 60 * 24, // 24 hours
  TRAVEL_PLANS: 60 * 60 * 2,   // 2 hours  
  CHAT_HISTORY: 60 * 30,       // 30 minutes
  USER_PREFERENCES: 60 * 60 * 6, // 6 hours
};

// Helper function to generate cache keys
function getCacheKey(type, ...args) {
  return `wr:${type}:${args.join(':')}`;
}

// -------------------------
// Cache Operations
// -------------------------

export async function cacheSet(key, value, ttl = 3600) {
  if (!redis) return false;
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn('Redis set error:', error.message);
    return false;
  }
}

export async function cacheGet(key) {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('Redis get error:', error.message);
    return null;
  }
}

export async function cacheDel(key) {
  if (!redis) return false;
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.warn('Redis del error:', error.message);
    return false;
  }
}

// -------------------------
// Application-specific Cache Functions
// -------------------------

// User session caching
export async function cacheUserSession(email, userData) {
  const key = getCacheKey('user', email);
  return await cacheSet(key, userData, CACHE_TTL.USER_SESSION);
}

export async function getCachedUserSession(email) {
  const key = getCacheKey('user', email);
  return await cacheGet(key);
}

export async function clearUserSession(email) {
  const key = getCacheKey('user', email);
  return await cacheDel(key);
}

// Travel plans caching
export async function cacheTravelPlans(userId, plans) {
  const key = getCacheKey('plans', userId);
  return await cacheSet(key, plans, CACHE_TTL.TRAVEL_PLANS);
}

export async function getCachedTravelPlans(userId) {
  const key = getCacheKey('plans', userId);
  return await cacheGet(key);
}

export async function clearTravelPlansCache(userId) {
  const key = getCacheKey('plans', userId);
  return await cacheDel(key);
}

// Chat history caching
export async function cacheChatHistory(userId, sessionId, messages) {
  const key = getCacheKey('chat', userId, sessionId);
  return await cacheSet(key, messages, CACHE_TTL.CHAT_HISTORY);
}

export async function getCachedChatHistory(userId, sessionId) {
  const key = getCacheKey('chat', userId, sessionId);
  return await cacheGet(key);
}

export async function clearChatHistoryCache(userId, sessionId) {
  const key = getCacheKey('chat', userId, sessionId);
  return await cacheDel(key);
}

// User preferences caching
export async function cacheUserPreferences(userId, preferences) {
  const key = getCacheKey('prefs', userId);
  return await cacheSet(key, preferences, CACHE_TTL.USER_PREFERENCES);
}

export async function getCachedUserPreferences(userId) {
  const key = getCacheKey('prefs', userId);
  return await cacheGet(key);
}

export async function clearUserPreferencesCache(userId) {
  const key = getCacheKey('prefs', userId);
  return await cacheDel(key);
}

// Magic token caching (short TTL for security)
export async function cacheMagicToken(hash, userData) {
  const key = getCacheKey('token', hash);
  return await cacheSet(key, userData, 600); // 10 minutes
}

export async function getCachedMagicToken(hash) {
  const key = getCacheKey('token', hash);
  return await cacheGet(key);
}

// Rate limiting
export async function incrementRateLimit(identifier, windowSeconds = 60) {
  if (!redis) return { count: 1, reset: Date.now() + windowSeconds * 1000 };
  
  try {
    const key = getCacheKey('rate', identifier);
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    const ttl = await redis.ttl(key);
    const reset = Date.now() + (ttl * 1000);
    
    return { count, reset };
  } catch (error) {
    console.warn('Rate limit error:', error.message);
    return { count: 1, reset: Date.now() + windowSeconds * 1000 };
  }
}

console.log(`🔄 Redis cache ${redis ? 'enabled' : 'disabled (running without cache)'}`);

export default {
  cacheSet,
  cacheGet,
  cacheDel,
  cacheUserSession,
  getCachedUserSession,
  clearUserSession,
  cacheTravelPlans,
  getCachedTravelPlans,
  clearTravelPlansCache,
  cacheChatHistory,
  getCachedChatHistory,
  clearChatHistoryCache,
  cacheUserPreferences,
  getCachedUserPreferences,
  clearUserPreferencesCache,
  cacheMagicToken,
  getCachedMagicToken,
  incrementRateLimit
}; 