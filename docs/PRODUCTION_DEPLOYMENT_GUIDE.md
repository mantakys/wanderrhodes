# Production Deployment Guide: Strict AI Workflow System

## Overview

The WanderRhodes application now includes a **Strict AI Workflow System** that provides intelligent, semantic POI recommendations with guaranteed data accuracy. This guide explains how to deploy and configure the system in production while maintaining the ability to switch between different AI implementations.

## Architecture Summary

The system now supports **4 AI workflow modes** that can be controlled via environment variables:

1. **Strict AI Workflow** (NEW) - AI decision → Server query → AI selection
2. **Enhanced POI System** - Spatial intelligence with PostgreSQL
3. **Traditional Chat Handler** - OpenAI with basic tools
4. **LangChain Agent Framework** - Multi-step reasoning with tool orchestration

## Environment Variable Configuration

### OpenAI Model Selection

The strict AI workflow requires models that support JSON mode. Choose based on your needs:

| Model | JSON Support | Cost | Performance | Recommended Use |
|-------|-------------|------|-------------|-----------------|
| `gpt-4o-mini` | ✅ | Low | Fast | **Production (Recommended)** |
| `gpt-4o` | ✅ | High | Best | High-accuracy scenarios |
| `gpt-4-1106-preview` | ✅ | Medium | Good | Legacy compatibility |

**Recommendation**: Use `gpt-4o-mini` for production - it provides excellent performance at the lowest cost while fully supporting JSON mode.

### Core Workflow Controls

```bash
# === MASTER WORKFLOW SWITCHES ===

# Enable the new strict AI workflow system
USE_STRICT_AI_WORKFLOW=true

# Fallback system when strict workflow fails
# Options: 'enhanced', 'traditional', 'basic'
STRICT_WORKFLOW_FALLBACK=enhanced

# OpenAI model for strict workflow (must support JSON mode)  
STRICT_WORKFLOW_MODEL=gpt-4o-mini

# === EXISTING SYSTEM CONTROLS ===

# Use LangChain agent vs traditional chat (existing)
USE_LANGCHAIN_AGENT=true

# Use enhanced chat tools with spatial intelligence (existing)
USE_ENHANCED_CHAT=true

# Use enhanced POI system with PostgreSQL (existing)
USE_ENHANCED_POI=true
```

### Advanced Configuration

```bash
# === WORKFLOW BEHAVIOR ===

# Enable automatic fallback when workflows fail
ENABLE_AUTO_FALLBACK=true

# Log workflow decisions for monitoring
LOG_WORKFLOW_DECISIONS=true

# Timeout for strict workflow execution (milliseconds)
STRICT_WORKFLOW_TIMEOUT=60000

# Maximum retries for failed strict workflow attempts
MAX_STRICT_WORKFLOW_RETRIES=2

# === MONITORING AND DEBUGGING ===

# Enable detailed workflow execution logging
WORKFLOW_DEBUG=true

# Enable performance monitoring
ENABLE_WORKFLOW_MONITORING=true

# Collect metrics on workflow success/failure rates
COLLECT_WORKFLOW_METRICS=true
```

## Production Deployment Configurations

### Configuration 1: Full Strict AI Workflow (Recommended)

```bash
# Vercel Environment Variables
USE_STRICT_AI_WORKFLOW=true
STRICT_WORKFLOW_FALLBACK=enhanced
STRICT_WORKFLOW_MODEL=gpt-4o-mini
USE_LANGCHAIN_AGENT=true
USE_ENHANCED_CHAT=true
USE_ENHANCED_POI=true
ENABLE_AUTO_FALLBACK=true
LOG_WORKFLOW_DECISIONS=true

# Required API Keys
OPENAI_API_KEY=your_openai_api_key
POSTGRES_POSTGRES_URL=your_postgres_connection_string
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### Configuration 2: Enhanced Fallback Mode

```bash
# If strict workflow has issues
USE_STRICT_AI_WORKFLOW=false
STRICT_WORKFLOW_FALLBACK=enhanced
USE_LANGCHAIN_AGENT=true
USE_ENHANCED_CHAT=true
USE_ENHANCED_POI=true
```

### Configuration 3: Traditional Stable Mode

```bash
# Conservative deployment
USE_STRICT_AI_WORKFLOW=false
USE_LANGCHAIN_AGENT=false
USE_ENHANCED_CHAT=true
USE_ENHANCED_POI=true
```

### Configuration 4: Emergency Basic Mode

```bash
# Minimum functionality
USE_STRICT_AI_WORKFLOW=false
USE_LANGCHAIN_AGENT=false
USE_ENHANCED_CHAT=false
USE_ENHANCED_POI=false
```

## Workflow Behavior Matrix

| Configuration | Step Planner | Chat Handler | Agent Framework |
|---------------|-------------|-------------|-----------------|
| Strict Enabled | Strict → Enhanced → Basic | Enhanced Chat | LangChain + Strict POI Tool |
| Enhanced Only | Enhanced → Basic | Enhanced Chat | LangChain + Enhanced Tools |
| Traditional | Enhanced → Basic | Traditional Chat | LangChain + Basic Tools |
| Basic | Basic Fallback | Traditional Chat | Traditional Chat |

## Monitoring and Logging

### Workflow Decision Logs

When `LOG_WORKFLOW_DECISIONS=true`, the system logs workflow usage:

```bash
🤖 WORKFLOW USAGE: strict @ poi-step-GET_INITIAL_RECOMMENDATIONS
🔄 WORKFLOW FALLBACK: strict → enhanced (Primary workflow failed)
```

### Success/Failure Tracking

Monitor these log patterns for system health:

```bash
# Successful workflows
✅ Strict AI workflow successful: Anthony Quinn Bay

# Failures with fallbacks  
❌ Strict AI workflow failed: No candidate POIs found
🔄 Using fallback: enhanced workflow

# Ultimate failures
💥 All workflows failed: falling back to basic system
```

## API Response Changes

### Enhanced Metadata

All API responses now include workflow information:

```json
{
  "reply": "Here are some great recommendations...",
  "structuredData": {
    "locations": [...],
    "metadata": {
      "workflow": "strict",
      "workflowConfig": {
        "strictWorkflow": true,
        "enhancedChat": true
      },
      "source": "strict_ai_workflow",
      "aiMetadata": {
        "roundDecision": {...},
        "fitScore": 9,
        "aiReasoning": "..."
      }
    }
  }
}
```

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] Verify all environment variables are set in Vercel dashboard
- [ ] Confirm PostgreSQL database is accessible
- [ ] Test OpenAI API key with GPT-4 Turbo model access
- [ ] Backup current production configuration

### 2. Deployment Process

```bash
# 1. Deploy to Vercel (automatic from git push)
git push origin master

# 2. Set environment variables in Vercel dashboard
# Use Configuration 1 (Full Strict AI Workflow)

# 3. Monitor deployment logs
vercel logs

# 4. Test endpoints
curl -X POST https://your-app.vercel.app/api/poi-step \
  -H "Content-Type: application/json" \
  -d '{"step": "GET_INITIAL_RECOMMENDATIONS", "userPreferences": {"interests": ["beaches"]}}'
```

### 3. Health Checks

Test each workflow configuration:

```bash
# Test strict workflow
USE_STRICT_AI_WORKFLOW=true

# Test enhanced fallback
USE_STRICT_AI_WORKFLOW=false

# Test traditional fallback  
USE_ENHANCED_CHAT=false

# Test basic fallback
USE_ENHANCED_POI=false
```

## Rollback Procedures

### Quick Rollback (Environment Variables Only)

Change a single environment variable in Vercel:

```bash
# Disable strict workflow immediately
USE_STRICT_AI_WORKFLOW=false
```

### Progressive Rollback

1. **Level 1**: Disable strict workflow
   ```bash
   USE_STRICT_AI_WORKFLOW=false
   ```

2. **Level 2**: Disable LangChain agent
   ```bash
   USE_LANGCHAIN_AGENT=false
   ```

3. **Level 3**: Disable enhanced features
   ```bash
   USE_ENHANCED_CHAT=false
   USE_ENHANCED_POI=false
   ```

### Code Rollback

```bash
# Revert to previous commit
git revert ab59c85
git push origin master
```

## Performance Considerations

### Strict Workflow Performance

- **Latency**: ~5-10 seconds per recommendation (AI reasoning + data query)
- **Cost**: Higher due to GPT-4 Turbo usage
- **Accuracy**: Highest - guaranteed real POI data
- **Concurrency**: Limited by OpenAI rate limits

### Recommended Optimizations

```bash
# Enable caching for repeated queries
ENABLE_CACHING=true

# Reduce timeout for faster failover
STRICT_WORKFLOW_TIMEOUT=30000

# Enable monitoring for performance tracking
ENABLE_WORKFLOW_MONITORING=true
```

## Troubleshooting

### Common Issues

1. **"Model does not support JSON mode"**
   ```bash
   # Fix: Use compatible model
   STRICT_WORKFLOW_MODEL=gpt-4-1106-preview
   ```

2. **"No candidate POIs found"**
   ```bash
   # Fix: Enable fallback
   ENABLE_AUTO_FALLBACK=true
   STRICT_WORKFLOW_FALLBACK=enhanced
   ```

3. **"Strict workflow timeout"**
   ```bash
   # Fix: Increase timeout or enable fallback
   STRICT_WORKFLOW_TIMEOUT=60000
   ENABLE_AUTO_FALLBACK=true
   ```

### Debug Mode

Enable comprehensive logging:

```bash
WORKFLOW_DEBUG=true
LOG_WORKFLOW_DECISIONS=true
NODE_ENV=development
```

## Cost Impact

### OpenAI API Usage

- **Strict Workflow**: ~2-4 API calls per recommendation
- **Traditional**: ~1 API call per recommendation  
- **Model**: GPT-4 Turbo (higher cost than GPT-3.5)

### Estimated Costs (per 1000 recommendations)

- **Strict Workflow**: $5-10
- **Enhanced System**: $2-4
- **Traditional System**: $1-2

## Security Considerations

- All API keys should be stored as environment variables
- PostgreSQL connection should use SSL
- Rate limiting is handled by OpenAI
- No sensitive data is logged when `NODE_ENV=production`

## Contact and Support

For deployment issues or questions:

1. Check Vercel deployment logs
2. Review environment variable configuration
3. Test with `backend/test-strict-workflow.js`
4. Monitor workflow decision logs

The system is designed for zero-downtime deployment with automatic fallbacks to ensure continuous service availability.