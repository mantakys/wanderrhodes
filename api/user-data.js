import jwt from 'jsonwebtoken';
import { 
  saveTravelPlan, 
  getUserTravelPlans, 
  deleteTravelPlan, 
  updateTravelPlan,
  saveChatMessage,
  getUserChatHistory,
  clearUserChatHistory,
  saveUserPreferences,
  getUserPreferences,
  getUserByEmail
} from '../backend/db-neon.js';
import { 
  getCachedTravelPlans, 
  cacheTravelPlans, 
  clearTravelPlansCache,
  getCachedChatHistory,
  cacheChatHistory,
  clearChatHistoryCache,
  getCachedUserPreferences,
  cacheUserPreferences,
  clearUserPreferencesCache
} from '../backend/cache.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Helper to authenticate user from cookie
function authenticateUser(req) {
  const token = req.cookies?.jwt;
  if (!token) {
    throw new Error('No authentication token');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded; // { email, iat, exp }
  } catch (error) {
    throw new Error('Invalid authentication token');
  }
}

// Helper to get user ID from email
async function getUserId(email) {
  const user = await getUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  return user.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const userAuth = authenticateUser(req);
    const userId = await getUserId(userAuth.email);
    
    const { action, data } = req.body;

    switch (action) {
      case 'save_travel_plan': {
        const { planData, planName } = data;
        if (!planData || !planName) {
          return res.status(400).json({ error: 'Missing plan data or name' });
        }

        const planId = await saveTravelPlan(userId, planData, planName);
        console.log(`💾 Saved travel plan for user ${userAuth.email}: ${planName}`);
        
        // Clear cache so next request fetches fresh data
        await clearTravelPlansCache(userId);
        
        return res.status(200).json({ 
          success: true, 
          planId,
          message: 'Travel plan saved successfully' 
        });
      }

      case 'get_travel_plans': {
        // Try cache first
        let plans = await getCachedTravelPlans(userId);
        if (!plans) {
          // Cache miss - fetch from database
          plans = await getUserTravelPlans(userId);
          // Cache for future requests
          await cacheTravelPlans(userId, plans);
        }
        
        console.log(`📋 Retrieved ${plans.length} travel plans for user ${userAuth.email}`);
        
        return res.status(200).json({ 
          success: true, 
          plans: plans.map(plan => ({
            id: plan.id,
            name: plan.plan_name,
            data: plan.plan_data,
            timestamp: plan.created_at * 1000, // Convert to milliseconds for compatibility
            createdAt: new Date(plan.created_at * 1000).toISOString(),
            updatedAt: new Date(plan.updated_at * 1000).toISOString()
          }))
        });
      }

      case 'delete_travel_plan': {
        const { planId } = data;
        if (!planId) {
          return res.status(400).json({ error: 'Missing plan ID' });
        }

        const result = await deleteTravelPlan(userId, planId);
        if (result.changes > 0) {
          console.log(`🗑️ Deleted travel plan ${planId} for user ${userAuth.email}`);
          // Clear cache so next request fetches fresh data
          await clearTravelPlansCache(userId);
          return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
        } else {
          return res.status(404).json({ error: 'Plan not found' });
        }
      }

      case 'update_travel_plan': {
        const { planId, planData, planName } = data;
        if (!planId || !planData || !planName) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await updateTravelPlan(userId, planId, planData, planName);
        if (result.changes > 0) {
          console.log(`✏️ Updated travel plan ${planId} for user ${userAuth.email}`);
          // Clear cache so next request fetches fresh data
          await clearTravelPlansCache(userId);
          return res.status(200).json({ success: true, message: 'Plan updated successfully' });
        } else {
          return res.status(404).json({ error: 'Plan not found' });
        }
      }

      case 'save_chat_message': {
        const { sessionId, messageData } = data;
        if (!sessionId || !messageData) {
          return res.status(400).json({ error: 'Missing session ID or message data' });
        }

        saveChatMessage(userId, sessionId, messageData);
        console.log(`💬 Saved chat message for user ${userAuth.email}, session ${sessionId}`);
        
        return res.status(200).json({ success: true, message: 'Chat message saved' });
      }

      case 'get_chat_history': {
        const { sessionId } = data;
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing session ID' });
        }

        const messages = getUserChatHistory(userId, sessionId);
        console.log(`💬 Retrieved ${messages.length} chat messages for user ${userAuth.email}, session ${sessionId}`);
        
        return res.status(200).json({ 
          success: true, 
          messages: messages.map(msg => ({
            ...msg.message_data,
            timestamp: msg.created_at * 1000
          }))
        });
      }

      case 'clear_chat_history': {
        const { sessionId } = data;
        if (!sessionId) {
          return res.status(400).json({ error: 'Missing session ID' });
        }

        const result = clearUserChatHistory(userId, sessionId);
        console.log(`🧹 Cleared chat history for user ${userAuth.email}, session ${sessionId}`);
        
        return res.status(200).json({ success: true, message: 'Chat history cleared' });
      }

      case 'save_preferences': {
        const { preferences } = data;
        if (!preferences) {
          return res.status(400).json({ error: 'Missing preferences data' });
        }

        saveUserPreferences(userId, preferences);
        console.log(`⚙️ Saved preferences for user ${userAuth.email}`);
        
        return res.status(200).json({ success: true, message: 'Preferences saved' });
      }

      case 'get_preferences': {
        const prefs = getUserPreferences(userId);
        console.log(`⚙️ Retrieved preferences for user ${userAuth.email}`);
        
        return res.status(200).json({ 
          success: true, 
          preferences: prefs?.preferences_data || null
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('🚨 User data API error:', error.message);
    
    if (error.message.includes('authentication')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    return res.status(500).json({ error: 'Internal server error' });
  }
} 