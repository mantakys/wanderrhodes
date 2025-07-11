// Database adapter - chooses between SQLite (dev) and Neon (production)

// Function to check if we have PostgreSQL environment variables
function hasPostgresConfig() {
  // Check for doubled prefix variables first
  if (process.env.POSTGRES_POSTGRES_URL) {
    return true;
  }
  
  // Check for original DATABASE_URL
  if (process.env.DATABASE_URL) {
    return true;
  }
  
  // Check for individual components with doubled prefix
  const host = process.env.POSTGRES_POSTGRES_HOST;
  const user = process.env.POSTGRES_POSTGRES_USER;
  const password = process.env.POSTGRES_POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_POSTGRES_DATABASE;
  
  return host && user && password && database;
}

const isProduction = process.env.NODE_ENV === 'production' || hasPostgresConfig();

let db;
let poiDB = null;

if (isProduction && hasPostgresConfig()) {
  console.log('🐘 Using Neon PostgreSQL for production');
  db = await import('./db-neon.js');
  
  // Import POI functions for production
  try {
    poiDB = await import('./db-poi.js');
    console.log('📍 POI database functions loaded');
  } catch (error) {
    console.warn('⚠️ POI database functions not available:', error.message);
  }
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

// Export POI functions if available
export const isPOIDataAvailable = poiDB?.isPOIDataAvailable || (() => Promise.resolve(false));
export const searchPOIsByType = poiDB?.searchPOIsByType || null;
export const getNearbyPOIs = poiDB?.getNearbyPOIs || null;
export const getSpatialRelationships = poiDB?.getSpatialRelationships || null;
export const getAdjacentPOIs = poiDB?.getAdjacentPOIs || null;
export const getWalkingDistancePOIs = poiDB?.getWalkingDistancePOIs || null;
export const getPOIClustersNear = poiDB?.getPOIClustersNear || null;
export const searchPOIsAdvanced = poiDB?.searchPOIsAdvanced || null;
export const getPOIStatistics = poiDB?.getPOIStatistics || null;
export const findPOIByNameAndLocation = poiDB?.findPOIByNameAndLocation || null;

// Helper function to check if POI features are available
export const hasPOIFeatures = () => poiDB !== null; 