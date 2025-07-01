import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Resolve a persistent database file inside the repository root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Open connection in default mode (will create file if missing)
const db = new Database(dbPath);

db.pragma('journal_mode = WAL'); // safer for concurrency

// -------------------------
// Schema (migrates on startup)
// -------------------------

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    has_paid INTEGER DEFAULT 0,
    free_chats_used INTEGER DEFAULT 0,
    magic_token_hash TEXT,
    magic_token_expires INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

// User travel plans table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_travel_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_data TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// User chat history table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_chat_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id TEXT NOT NULL,
    message_data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// User preferences table
db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    preferences_data TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// Add missing columns if they don't exist (for existing databases)
try {
  db.exec(`ALTER TABLE users ADD COLUMN magic_token_hash TEXT;`);
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN magic_token_expires INTEGER;`);
} catch (e) {
  // Column already exists, ignore
}

try {
  db.exec(`ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT (strftime('%s','now'));`);
} catch (e) {
  // Column already exists, ignore
}

// -------------------------
// Helper Statements
// -------------------------

const getUserStmt = db.prepare('SELECT * FROM users WHERE email = ?');
const getUserByTokenStmt = db.prepare('SELECT * FROM users WHERE magic_token_hash = ?');
const insertUserStmt = db.prepare('INSERT INTO users (email, has_paid) VALUES (?, ?)');
const updatePaidStmt = db.prepare('UPDATE users SET has_paid = 1 WHERE email = ?');
const updateTokenStmt = db.prepare('UPDATE users SET magic_token_hash = ?, magic_token_expires = ? WHERE email = ?');
const clearTokenStmt = db.prepare('UPDATE users SET magic_token_hash = NULL, magic_token_expires = NULL WHERE email = ?');
const incFreeChatsStmt = db.prepare('UPDATE users SET free_chats_used = free_chats_used + 1 WHERE email = ?');
const setFreeChatsStmt = db.prepare('UPDATE users SET free_chats_used = ? WHERE email = ?');
const getAllUsersStmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE email = ?');

// Travel plans statements
const saveTravelPlanStmt = db.prepare('INSERT INTO user_travel_plans (user_id, plan_data, plan_name) VALUES (?, ?, ?)');
const getUserTravelPlansStmt = db.prepare('SELECT * FROM user_travel_plans WHERE user_id = ? ORDER BY created_at DESC');
const deleteTravelPlanStmt = db.prepare('DELETE FROM user_travel_plans WHERE user_id = ? AND id = ?');
const updateTravelPlanStmt = db.prepare('UPDATE user_travel_plans SET plan_data = ?, plan_name = ?, updated_at = strftime(\'%s\',\'now\') WHERE user_id = ? AND id = ?');

// Chat history statements
const saveChatMessageStmt = db.prepare('INSERT INTO user_chat_history (user_id, session_id, message_data) VALUES (?, ?, ?)');
const getUserChatHistoryStmt = db.prepare('SELECT * FROM user_chat_history WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC');
const clearUserChatHistoryStmt = db.prepare('DELETE FROM user_chat_history WHERE user_id = ? AND session_id = ?');

// Preferences statements
const saveUserPreferencesStmt = db.prepare('INSERT OR REPLACE INTO user_preferences (user_id, preferences_data, updated_at) VALUES (?, ?, strftime(\'%s\',\'now\'))');
const getUserPreferencesStmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');

// -------------------------
// Public API
// -------------------------
export function getUserByEmail(email) {
  return getUserStmt.get(email.toLowerCase());
}

export function getUserByMagicToken(hash) {
  return getUserByTokenStmt.get(hash);
}

export function upsertUser(email, hasPaid = false) {
  const user = getUserByEmail(email);
  if (user) {
    if (hasPaid && !user.has_paid) updatePaidStmt.run(email.toLowerCase());
    return getUserByEmail(email);
  }
  insertUserStmt.run(email.toLowerCase(), hasPaid ? 1 : 0);
  return getUserByEmail(email);
}

export function setMagicToken(email, hash, expires) {
  console.log(`🔐 [DB] Setting magic token for ${email}, expires: ${new Date(expires)}`);
  const result = updateTokenStmt.run(hash, expires, email.toLowerCase());
  console.log(`✅ [DB] Magic token set, changes: ${result.changes}`);
  
  // Verify the token was set correctly
  const user = getUserByEmail(email);
  console.log(`🔍 [DB] Verification - User token hash: ${user?.magic_token_hash ? 'SET' : 'NULL'}, expires: ${user?.magic_token_expires ? new Date(user.magic_token_expires) : 'NULL'}`);
}

export function clearMagicToken(email) {
  clearTokenStmt.run(email.toLowerCase());
}

export function markUserPaid(email) {
  updatePaidStmt.run(email.toLowerCase());
}

export function incrementFreeChats(email) {
  incFreeChatsStmt.run(email.toLowerCase());
}

export function setFreeChats(email, count) {
  setFreeChatsStmt.run(count, email.toLowerCase());
}

export function getAllUsers() {
  return getAllUsersStmt.all();
}

export function deleteUserByEmail(email) {
  return deleteUserStmt.run(email.toLowerCase());
}

// Travel Plans API
export function saveTravelPlan(userId, planData, planName) {
  const result = saveTravelPlanStmt.run(userId, JSON.stringify(planData), planName);
  return result.lastInsertRowid;
}

export function getUserTravelPlans(userId) {
  const plans = getUserTravelPlansStmt.all(userId);
  return plans.map(plan => ({
    ...plan,
    plan_data: JSON.parse(plan.plan_data)
  }));
}

export function deleteTravelPlan(userId, planId) {
  return deleteTravelPlanStmt.run(userId, planId);
}

export function updateTravelPlan(userId, planId, planData, planName) {
  return updateTravelPlanStmt.run(JSON.stringify(planData), planName, userId, planId);
}

// Chat History API
export function saveChatMessage(userId, sessionId, messageData) {
  return saveChatMessageStmt.run(userId, sessionId, JSON.stringify(messageData));
}

export function getUserChatHistory(userId, sessionId) {
  const messages = getUserChatHistoryStmt.all(userId, sessionId);
  return messages.map(msg => ({
    ...msg,
    message_data: JSON.parse(msg.message_data)
  }));
}

export function clearUserChatHistory(userId, sessionId) {
  return clearUserChatHistoryStmt.run(userId, sessionId);
}

// User Preferences API
export function saveUserPreferences(userId, preferencesData) {
  return saveUserPreferencesStmt.run(userId, JSON.stringify(preferencesData));
}

export function getUserPreferences(userId) {
  const prefs = getUserPreferencesStmt.get(userId);
  if (!prefs) return null;
  return {
    ...prefs,
    preferences_data: JSON.parse(prefs.preferences_data)
  };
}

export function close() {
  db.close();
} 
