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
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
`);

// -------------------------
// Helper Statements
// -------------------------

const getUserStmt = db.prepare('SELECT * FROM users WHERE email = ?');
const insertUserStmt = db.prepare('INSERT INTO users (email, has_paid) VALUES (?, ?)');
const updatePaidStmt = db.prepare('UPDATE users SET has_paid = 1 WHERE email = ?');
const updateTokenStmt = db.prepare('UPDATE users SET magic_token_hash = ?, magic_token_expires = ? WHERE email = ?');
const clearTokenStmt = db.prepare('UPDATE users SET magic_token_hash = NULL, magic_token_expires = NULL WHERE email = ?');
const incFreeChatsStmt = db.prepare('UPDATE users SET free_chats_used = free_chats_used + 1 WHERE email = ?');
const setFreeChatsStmt = db.prepare('UPDATE users SET free_chats_used = ? WHERE email = ?');
const getAllUsersStmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
const deleteUserStmt = db.prepare('DELETE FROM users WHERE email = ?');

// -------------------------
// Public API
// -------------------------
export function getUserByEmail(email) {
  return getUserStmt.get(email.toLowerCase());
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
  updateTokenStmt.run(hash, expires, email.toLowerCase());
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

export function close() {
  db.close();
} 
