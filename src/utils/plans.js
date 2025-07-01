// src/utils/plans.js
// Utility helpers to save and retrieve travel plans from the backend for authenticated users

// Legacy localStorage helpers (fallback for non-authenticated users)
const FREE_PLAN_KEY = 'wr_free_plan_used';

function getLocalPlans() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('travelPlans');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPlan(plan) {
  const plans = getLocalPlans();
  plans.unshift(plan);
  try {
    localStorage.setItem('travelPlans', JSON.stringify(plans.slice(0, 50)));
  } catch {}
}

function deleteLocalPlan(timestamp) {
  const plans = getLocalPlans().filter((p) => p.timestamp !== timestamp);
  localStorage.setItem('travelPlans', JSON.stringify(plans));
}

// Backend API helpers
async function callUserDataAPI(action, data = {}) {
  try {
    const response = await fetch('/api/user-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for authentication
      body: JSON.stringify({ action, data })
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'API call failed');
    }
    
    return result;
  } catch (error) {
    console.error(`API call failed (${action}):`, error.message);
    throw error;
  }
}

// Main API functions
export async function getSavedPlans(user = null) {
  // If user is authenticated, get plans from backend
  if (user?.email) {
    try {
      const result = await callUserDataAPI('get_travel_plans');
      console.log(`📋 Retrieved ${result.plans.length} plans from backend for ${user.email}`);
      return result.plans;
    } catch (error) {
      console.error('Failed to get plans from backend, falling back to localStorage:', error.message);
      return getLocalPlans(); // Fallback to localStorage
    }
  }
  
  // For non-authenticated users, use localStorage
  return getLocalPlans();
}

export async function canSaveAnotherPlan(user = null) {
  console.log(`🔍 Checking quota for user:`, { 
    email: user?.email, 
    has_paid: user?.has_paid,
    userExists: !!user 
  });
  
  // Paid users can save unlimited plans
  if (user?.has_paid) {
    console.log(`✅ Paid user - unlimited saves allowed`);
    return true;
  }
  
  // For authenticated users, check their backend plans count
  if (user?.email) {
    try {
      const plans = await getSavedPlans(user);
      console.log(`📊 Authenticated user has ${plans.length} saved plans`);
      
      // Give authenticated users 3 free plans (increased from 1 to be more generous)
      const canSave = plans.length < 3;
      console.log(`${canSave ? '✅' : '❌'} Can save: ${canSave} (${plans.length}/3 plans used)`);
      return canSave;
    } catch (error) {
      console.error('Failed to check plan quota for authenticated user:', error);
      // Fallback to localStorage check
      if (typeof window === 'undefined') return true;
      return localStorage.getItem(FREE_PLAN_KEY) !== 'true';
    }
  }
  
  // For anonymous users, check localStorage
  if (typeof window === 'undefined') return true;
  const canSave = localStorage.getItem(FREE_PLAN_KEY) !== 'true';
  console.log(`${canSave ? '✅' : '❌'} Anonymous user can save: ${canSave}`);
  return canSave;
}

export async function savePlan(plan, user = null) {
  // If user is authenticated, save to backend
  if (user?.email) {
    try {
      // Check quota for non-paid users
      if (!user.has_paid && !(await canSaveAnotherPlan(user))) {
        return false; // quota reached
      }

      const result = await callUserDataAPI('save_travel_plan', {
        planData: plan,
        planName: plan.name || `Rhodes Adventure #${Date.now()}`
      });

      console.log(`💾 Saved plan to backend for ${user.email}: ${plan.name}`);
      
      // For authenticated users, don't mark localStorage quota - their quota is tracked in backend
      
      return true;
    } catch (error) {
      console.error('Failed to save plan to backend:', error.message);
      // Don't fallback to localStorage for authenticated users - they expect server persistence
      return false;
    }
  }

  // For non-authenticated users, use localStorage
  if (!(await canSaveAnotherPlan(user))) {
    return false; // quota reached
  }
  
  // Mark quota used for anonymous users
  if (typeof window !== 'undefined') {
    localStorage.setItem(FREE_PLAN_KEY, 'true');
  }
  
  saveLocalPlan(plan);
  return true;
}

export async function deletePlan(planIdentifier, user = null) {
  // If user is authenticated, delete from backend
  if (user?.email) {
    try {
      // For backend plans, planIdentifier is the plan ID
      if (typeof planIdentifier === 'number') {
        await callUserDataAPI('delete_travel_plan', { planId: planIdentifier });
        console.log(`🗑️ Deleted plan ${planIdentifier} from backend for ${user.email}`);
        return true;
      }
    } catch (error) {
      console.error('Failed to delete plan from backend:', error.message);
      return false;
    }
  }

  // For non-authenticated users or legacy timestamp-based deletion
  deleteLocalPlan(planIdentifier);
  return true;
}

// New functions for user preferences
export async function saveUserPreferences(preferences, user = null) {
  if (user?.email) {
    try {
      await callUserDataAPI('save_preferences', { preferences });
      console.log(`⚙️ Saved preferences for ${user.email}`);
      return true;
    } catch (error) {
      console.error('Failed to save preferences:', error.message);
      return false;
    }
  }
  return false;
}

export async function getUserPreferences(user = null) {
  if (user?.email) {
    try {
      const result = await callUserDataAPI('get_preferences');
      console.log(`⚙️ Retrieved preferences for ${user.email}`);
      return result.preferences;
    } catch (error) {
      console.error('Failed to get preferences:', error.message);
      return null;
    }
  }
  return null;
}

// Chat history functions
export async function saveChatMessage(sessionId, messageData, user = null) {
  if (user?.email && sessionId) {
    try {
      await callUserDataAPI('save_chat_message', { sessionId, messageData });
      return true;
    } catch (error) {
      console.error('Failed to save chat message:', error.message);
      return false;
    }
  }
  return false;
}

export async function getChatHistory(sessionId, user = null) {
  if (user?.email && sessionId) {
    try {
      const result = await callUserDataAPI('get_chat_history', { sessionId });
      return result.messages;
    } catch (error) {
      console.error('Failed to get chat history:', error.message);
      return [];
    }
  }
  return [];
}

export async function clearChatHistory(sessionId, user = null) {
  if (user?.email && sessionId) {
    try {
      await callUserDataAPI('clear_chat_history', { sessionId });
      return true;
    } catch (error) {
      console.error('Failed to clear chat history:', error.message);
      return false;
    }
  }
  return false;
} 