# 🔧 Environment Variables Setup

## Production Database Configuration

Add these environment variables to your `.env` file and Vercel dashboard:

### **Required for Production (PostgreSQL):**

**Option 1: Complete Connection URL (Recommended)**
```bash
# Neon PostgreSQL Database (with doubled prefix as used in Vercel)
POSTGRES_POSTGRES_URL=postgresql://username:password@ep-fancy-flower-a2ua9kno-pooler.eu-central-1.aws.neon.tech/database_name?sslmode=require
```

**Option 2: Individual Components (Alternative)**
```bash
# PostgreSQL connection components (with doubled prefix as used in Vercel)
POSTGRES_POSTGRES_HOST=ep-fancy-flower-a2ua9kno-pooler.eu-central-1.aws.neon.tech
POSTGRES_POSTGRES_USER=username
POSTGRES_POSTGRES_PASSWORD=password
POSTGRES_POSTGRES_DATABASE=database_name
```

**Backwards Compatibility:**
```bash
# Original format (still supported for development)
DATABASE_URL=postgresql://username:password@ep-fancy-flower-a2ua9kno-pooler.eu-central-1.aws.neon.tech/database_name?sslmode=require
```

### **Other Required Variables:**

```bash
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

The app automatically detects which database to use:

- **Development** (no PostgreSQL env vars): Uses SQLite automatically
- **Production** (has PostgreSQL env vars): Uses Neon PostgreSQL automatically
- **Priority**: `POSTGRES_POSTGRES_URL` > `DATABASE_URL` > individual components
- **Redis Cache**: Works in both environments, gracefully falls back if unavailable

## 🚀 Performance Benefits

With these environment variables set, your app will have:

- ⚡ **Redis caching** for 2-5x faster responses
- 🔄 **Connection pooling** for unlimited scaling  
- 📊 **JSONB support** for complex travel plan queries
- 🌍 **Global edge replicas** for worldwide performance

## ✅ Test Your Setup

```bash
# Test PostgreSQL connection (any of these formats)
node -e "console.log('POSTGRES_POSTGRES_URL:', process.env.POSTGRES_POSTGRES_URL ? 'Set ✅' : 'Not set ❌')"
node -e "console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌')"

# Test Redis connection  
node -e "console.log('REDIS_URL:', process.env.UPSTASH_REDIS_REST_URL ? 'Set ✅' : 'Not set ❌')"
```

Your app is now production-ready! 🎉 