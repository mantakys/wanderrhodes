# 🚀 Production Database Setup Guide

## Overview
This guide walks you through migrating from SQLite to **Neon PostgreSQL** with **Upstash Redis** caching for production deployment.

## 📋 Prerequisites
- Vercel account (for hosting)
- Neon account (for PostgreSQL database)
- Upstash account (for Redis cache) - Optional but recommended

---

## 🗄️ Phase 1: Neon PostgreSQL Setup

### 1. Create Neon Database
1. Visit [Neon.tech](https://neon.tech) and create an account
2. Create a new project: **"wanderrhodes-production"**
3. Choose region closest to your users
4. Copy the connection string from the dashboard

### 2. Environment Configuration
Add to your `.env` file:
```bash
# Production Database (Preferred format - matches Vercel)
POSTGRES_POSTGRES_URL="postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require"

# Alternative: Individual components (matches Vercel doubled prefix)
POSTGRES_POSTGRES_HOST="[endpoint]"
POSTGRES_POSTGRES_USER="[user]"
POSTGRES_POSTGRES_PASSWORD="[password]"
POSTGRES_POSTGRES_DATABASE="[database]"

# Backwards compatibility (still supported)
DATABASE_URL="postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require"

# Optional: Separate databases for different environments
DATABASE_URL_PROD="postgresql://..."
DATABASE_URL_DEV="postgresql://..."
```

### 3. Install Dependencies
```bash
npm install pg @upstash/redis
```

---

## ⚡ Phase 2: Upstash Redis Setup (Optional but Recommended)

### 1. Create Upstash Redis Database
1. Visit [Upstash Console](https://console.upstash.com)
2. Create a new Redis database: **"wanderrhodes-cache"**
3. Choose region matching your Neon database
4. Copy the REST URL and token

### 2. Add Redis Environment Variables
```bash
# Redis Cache (Optional)
UPSTASH_REDIS_REST_URL="https://[region]-[id].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[your-token]"
```

---

## 🔄 Phase 3: Database Migration

### 1. Switch Database Import
Update your imports to use Neon:

In your API files, replace:
```javascript
// OLD
import * as db from '../backend/db.js';

// NEW  
import * as db from '../backend/db-neon.js';
```

### 2. Run Migration (if you have existing data)
```bash
npm run migrate:neon
```

### 3. Test Connection
```bash
# Test the new database setup
node -e "import('./backend/db-neon.js').then(m => console.log('✅ Neon connection successful'))"
```

---

## 🚀 Phase 4: Vercel Deployment

### 1. Environment Variables in Vercel
In your Vercel dashboard, add these environment variables:

**Required PostgreSQL Configuration (use the format that matches your Vercel setup):**
- `POSTGRES_POSTGRES_URL` - Your Neon PostgreSQL connection string (preferred)
- OR individual components:
  - `POSTGRES_POSTGRES_HOST` - Your database host
  - `POSTGRES_POSTGRES_USER` - Your database user
  - `POSTGRES_POSTGRES_PASSWORD` - Your database password
  - `POSTGRES_POSTGRES_DATABASE` - Your database name
- OR `DATABASE_URL` - Your Neon PostgreSQL connection string (legacy format)

**Other Required:**
- `JWT_SECRET` - Your JWT secret key
- `DOMAIN` - Your production domain
- All your existing Stripe, email, and API keys

**Optional (for Redis caching):**
- `UPSTASH_REDIS_REST_URL` 
- `UPSTASH_REDIS_REST_TOKEN`

### 2. Deploy
```bash
# Deploy to Vercel
vercel --prod
```

---

## 🎯 Benefits After Migration

### **Neon PostgreSQL Advantages:**
✅ **Serverless scaling** - Auto-scales with traffic  
✅ **Connection pooling** - No connection limit issues  
✅ **JSONB support** - Better performance for complex data  
✅ **Database branching** - Separate dev/staging/prod  
✅ **Point-in-time recovery** - Data safety  
✅ **Edge replicas** - Faster global reads  

### **Redis Cache Advantages:**
⚡ **Faster response times** - Cached user data  
⚡ **Reduced database load** - Less PostgreSQL queries  
⚡ **Session management** - Improved auth performance  
⚡ **Rate limiting** - Built-in API protection  

---

## 🔧 Performance Optimization Tips

### 1. Database Queries
- Use JSONB operators for complex travel plan queries
- Index frequently queried fields (already included)
- Use prepared statements (already implemented)

### 2. Caching Strategy
- User sessions cached for 24 hours
- Travel plans cached for 2 hours
- Chat history cached for 30 minutes
- Preferences cached for 6 hours

### 3. Connection Management
- Connection pooling with 20 max connections
- 2-second connection timeout
- Automatic cleanup and reconnection

---

## 🛠️ Troubleshooting

### Common Issues:

**1. Connection Timeout**
```bash
# Check if DATABASE_URL is correct
echo $DATABASE_URL
```

**2. Migration Errors**
```bash
# Verify source SQLite database exists
ls -la database.sqlite

# Check Neon connection
node -e "import('./backend/db-neon.js').then(m => console.log('Connected'))"
```

**3. Redis Connection**
```bash
# Test Redis connection
node -e "import('./backend/cache.js').then(m => m.cacheSet('test', 'hello')).then(() => console.log('Redis working'))"
```

---

## 🔄 Migration Rollback Plan

If you need to rollback:

1. **Keep SQLite files** as backup
2. **Switch imports back** to `db.js`
3. **Remove new environment variables**
4. **Redeploy with original setup**

---

## 📊 Monitoring & Maintenance

### Database Health Checks:
- Monitor query performance in Neon dashboard
- Set up alerts for connection issues
- Track cache hit rates in Upstash

### Regular Tasks:
- Review slow queries monthly
- Clean up old chat history data
- Monitor storage usage

---

## 🎉 Next Steps

Once migration is complete:

1. **Monitor performance** in production
2. **Set up database backups** (Neon handles this automatically)
3. **Implement database analytics** if needed
4. **Consider adding read replicas** for global users

Your WanderRhodes app is now production-ready with enterprise-grade database infrastructure! 🚀 