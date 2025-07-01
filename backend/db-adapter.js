// Database adapter - chooses between SQLite (dev) and Neon (production)
const isProduction = process.env.NODE_ENV === 'production' || process.env.DATABASE_URL;

let db;

if (isProduction && process.env.DATABASE_URL) {
  console.log('🐘 Using Neon PostgreSQL for production');
  db = await import('./db-neon.js');
} else {
  console.log('🗄️ Using SQLite for development');  
  db = await import('./db.js');
}

// Re-export all database functions
export const getUserByEmail = db.getUserByEmail;
export const getUserByMagicToken = db.getUserByMagicToken;
export const upsertUser = db.upsertUser;
export const setMagicToken = db.setMagicToken;
export const clearMagicToken = db.clearMagicToken;
export const markUserPaid = db.markUserPaid;
export const incrementFreeChats = db.incrementFreeChats;
export const setFreeChats = db.setFreeChats;
export const getAllUsers = db.getAllUsers;
export const deleteUserByEmail = db.deleteUserByEmail;
export const saveTravelPlan = db.saveTravelPlan;
export const getUserTravelPlans = db.getUserTravelPlans;
export const deleteTravelPlan = db.deleteTravelPlan;
export const updateTravelPlan = db.updateTravelPlan;
export const saveChatMessage = db.saveChatMessage;
export const getUserChatHistory = db.getUserChatHistory;
export const clearUserChatHistory = db.clearUserChatHistory;
export const saveUserPreferences = db.saveUserPreferences;
export const getUserPreferences = db.getUserPreferences;
export const close = db.close; 