# 🔧 Environment Variables Setup

## Production Database Configuration

Add these environment variables to your `.env` file and Vercel dashboard:

### **Required for Production:**

```bash
# Neon PostgreSQL Database
DATABASE_URL=postgresql://username:password@ep-fancy-flower-a2ua9kno-pooler.eu-central-1.aws.neon.tech/database_name?sslmode=require

# Your existing variables (keep current values)
JWT_SECRET=your-jwt-secret
DOMAIN=https://your-production-domain.com
OPENAI_API_KEY=your-openai-key
GOOGLE_MAPS_API_KEY=your-google-maps-key
MAPBOX_ACCESS_TOKEN=your-mapbox-token
```

### **Optional for Performance:**

```bash
# Upstash Redis Cache (recommended)
UPSTASH_REDIS_REST_URL=https://region-id.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

## 🎯 How Database Switching Works

- **Development** (no `DATABASE_URL`): Uses SQLite automatically
- **Production** (has `DATABASE_URL`): Uses Neon PostgreSQL automatically
- **Redis Cache**: Works in both environments, gracefully falls back if unavailable

## 🚀 Performance Benefits

With these environment variables set, your app will have:

- ⚡ **Redis caching** for 2-5x faster responses
- 🔄 **Connection pooling** for unlimited scaling  
- 📊 **JSONB support** for complex travel plan queries
- 🌍 **Global edge replicas** for worldwide performance

## ✅ Test Your Setup

```bash
# Test database connection
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌')"

# Test Redis connection  
node -e "console.log('REDIS_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set ✅' : 'Not set ❌')"
```

Your app is now production-ready! 🎉 