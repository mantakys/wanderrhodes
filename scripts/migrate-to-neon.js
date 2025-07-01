import Database from 'better-sqlite3';
import * as neonDb from '../backend/db-neon.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqliteDbPath = path.join(__dirname, '..', 'database.sqlite');

console.log('🚀 Starting SQLite to Neon PostgreSQL migration...');

async function migrate() {
  // Open SQLite database
  const sqlite = new Database(sqliteDbPath);
  
  try {
    // Migrate users
    console.log('📝 Migrating users...');
    const users = sqlite.prepare('SELECT * FROM users').all();
    const userIdMap = new Map(); // SQLite ID -> PostgreSQL ID mapping
    
    for (const user of users) {
      const newUser = await neonDb.upsertUser(user.email, user.has_paid);
      userIdMap.set(user.id, newUser.id);
      
      // Migrate additional user data
      if (user.free_chats_used > 0) {
        await neonDb.setFreeChats(user.email, user.free_chats_used);
      }
      
      if (user.magic_token_hash) {
        await neonDb.setMagicToken(user.email, user.magic_token_hash, user.magic_token_expires);
      }
    }
    console.log(`✅ Migrated ${users.length} users`);

    // Migrate travel plans
    console.log('🗺️ Migrating travel plans...');
    const plans = sqlite.prepare('SELECT * FROM user_travel_plans').all();
    for (const plan of plans) {
      const newUserId = userIdMap.get(plan.user_id);
      if (newUserId) {
        const planData = JSON.parse(plan.plan_data);
        await neonDb.saveTravelPlan(newUserId, planData, plan.plan_name);
      }
    }
    console.log(`✅ Migrated ${plans.length} travel plans`);

    // Migrate chat history
    console.log('💬 Migrating chat history...');
    const chatMessages = sqlite.prepare('SELECT * FROM user_chat_history').all();
    for (const message of chatMessages) {
      const newUserId = userIdMap.get(message.user_id);
      if (newUserId) {
        const messageData = JSON.parse(message.message_data);
        await neonDb.saveChatMessage(newUserId, message.session_id, messageData);
      }
    }
    console.log(`✅ Migrated ${chatMessages.length} chat messages`);

    // Migrate preferences
    console.log('⚙️ Migrating user preferences...');
    const preferences = sqlite.prepare('SELECT * FROM user_preferences').all();
    for (const pref of preferences) {
      const newUserId = userIdMap.get(pref.user_id);
      if (newUserId) {
        const preferencesData = JSON.parse(pref.preferences_data);
        await neonDb.saveUserPreferences(newUserId, preferencesData);
      }
    }
    console.log(`✅ Migrated ${preferences.length} user preferences`);

    console.log('🎉 Migration completed successfully!');
    
    // Verify migration
    console.log('🔍 Verifying migration...');
    const migratedUsers = await neonDb.getAllUsers();
    console.log(`📊 Verification: ${migratedUsers.length} users in Neon PostgreSQL`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqlite.close();
    await neonDb.close();
  }
}

migrate().catch(console.error); 