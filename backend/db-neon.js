import pkg from 'pg';
const { Pool } = pkg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// -------------------------
// Schema (PostgreSQL version)
// -------------------------

async function initSchema() {
  const client = await pool.connect();
  try {
    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        has_paid BOOLEAN DEFAULT FALSE,
        free_chats_used INTEGER DEFAULT 0,
        magic_token_hash VARCHAR(255),
        magic_token_expires BIGINT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User travel plans table  
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_travel_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_data JSONB NOT NULL,
        plan_name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User chat history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_chat_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id VARCHAR(255) NOT NULL,
        message_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // User preferences table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        preferences_data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for performance
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_magic_token ON users(magic_token_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_travel_plans_user ON user_travel_plans(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_user_session ON user_chat_history(user_id, session_id);`);

    console.log('✅ Neon PostgreSQL schema initialized');
  } finally {
    client.release();
  }
}

// Initialize schema on startup
initSchema().catch(console.error);

// -------------------------
// Helper Functions
// -------------------------

async function executeQuery(query, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

// -------------------------
// Public API (same interface as SQLite version)
// -------------------------

export async function getUserByEmail(email) {
  const result = await executeQuery('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  return result.rows[0] || null;
}

export async function getUserByMagicToken(hash) {
  const result = await executeQuery('SELECT * FROM users WHERE magic_token_hash = $1', [hash]);
  return result.rows[0] || null;
}

export async function upsertUser(email, hasPaid = false) {
  const user = await getUserByEmail(email);
  if (user) {
    if (hasPaid && !user.has_paid) {
      await executeQuery('UPDATE users SET has_paid = TRUE WHERE email = $1', [email.toLowerCase()]);
    }
    return await getUserByEmail(email);
  }
  
  const result = await executeQuery(
    'INSERT INTO users (email, has_paid) VALUES ($1, $2) RETURNING *',
    [email.toLowerCase(), hasPaid]
  );
  return result.rows[0];
}

export async function setMagicToken(email, hash, expires) {
  console.log(`🔐 [DB] Setting magic token for ${email}, expires: ${new Date(expires)}`);
  const result = await executeQuery(
    'UPDATE users SET magic_token_hash = $1, magic_token_expires = $2 WHERE email = $3',
    [hash, expires, email.toLowerCase()]
  );
  console.log(`✅ [DB] Magic token set, rows affected: ${result.rowCount}`);
}

export async function clearMagicToken(email) {
  await executeQuery(
    'UPDATE users SET magic_token_hash = NULL, magic_token_expires = NULL WHERE email = $1',
    [email.toLowerCase()]
  );
}

export async function markUserPaid(email) {
  await executeQuery('UPDATE users SET has_paid = TRUE WHERE email = $1', [email.toLowerCase()]);
}

export async function incrementFreeChats(email) {
  await executeQuery(
    'UPDATE users SET free_chats_used = free_chats_used + 1 WHERE email = $1',
    [email.toLowerCase()]
  );
}

export async function setFreeChats(email, count) {
  await executeQuery(
    'UPDATE users SET free_chats_used = $1 WHERE email = $2',
    [count, email.toLowerCase()]
  );
}

export async function getAllUsers() {
  const result = await executeQuery('SELECT * FROM users ORDER BY created_at DESC');
  return result.rows;
}

export async function deleteUserByEmail(email) {
  const result = await executeQuery('DELETE FROM users WHERE email = $1', [email.toLowerCase()]);
  return { changes: result.rowCount };
}

// Travel Plans API
export async function saveTravelPlan(userId, planData, planName) {
  const result = await executeQuery(
    'INSERT INTO user_travel_plans (user_id, plan_data, plan_name) VALUES ($1, $2, $3) RETURNING id',
    [userId, JSON.stringify(planData), planName]
  );
  return result.rows[0].id;
}

export async function getUserTravelPlans(userId) {
  const result = await executeQuery(
    'SELECT * FROM user_travel_plans WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map(plan => ({
    ...plan,
    plan_data: typeof plan.plan_data === 'string' ? JSON.parse(plan.plan_data) : plan.plan_data,
    created_at: Math.floor(new Date(plan.created_at).getTime() / 1000),
    updated_at: Math.floor(new Date(plan.updated_at).getTime() / 1000)
  }));
}

export async function deleteTravelPlan(userId, planId) {
  const result = await executeQuery(
    'DELETE FROM user_travel_plans WHERE user_id = $1 AND id = $2',
    [userId, planId]
  );
  return { changes: result.rowCount };
}

export async function updateTravelPlan(userId, planId, planData, planName) {
  const result = await executeQuery(
    'UPDATE user_travel_plans SET plan_data = $1, plan_name = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND id = $4',
    [JSON.stringify(planData), planName, userId, planId]
  );
  return { changes: result.rowCount };
}

// Chat History API
export async function saveChatMessage(userId, sessionId, messageData) {
  const result = await executeQuery(
    'INSERT INTO user_chat_history (user_id, session_id, message_data) VALUES ($1, $2, $3) RETURNING id',
    [userId, sessionId, JSON.stringify(messageData)]
  );
  return result.rows[0].id;
}

export async function getUserChatHistory(userId, sessionId) {
  const result = await executeQuery(
    'SELECT * FROM user_chat_history WHERE user_id = $1 AND session_id = $2 ORDER BY created_at ASC',
    [userId, sessionId]
  );
  return result.rows.map(msg => ({
    ...msg,
    message_data: typeof msg.message_data === 'string' ? JSON.parse(msg.message_data) : msg.message_data,
    created_at: Math.floor(new Date(msg.created_at).getTime() / 1000)
  }));
}

export async function clearUserChatHistory(userId, sessionId) {
  const result = await executeQuery(
    'DELETE FROM user_chat_history WHERE user_id = $1 AND session_id = $2',
    [userId, sessionId]
  );
  return { changes: result.rowCount };
}

// Preferences API
export async function saveUserPreferences(userId, preferencesData) {
  await executeQuery(
    `INSERT INTO user_preferences (user_id, preferences_data, updated_at) 
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) 
     DO UPDATE SET preferences_data = $2, updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(preferencesData)]
  );
}

export async function getUserPreferences(userId) {
  const result = await executeQuery(
    'SELECT * FROM user_preferences WHERE user_id = $1',
    [userId]
  );
  if (result.rows[0]) {
    return {
      ...result.rows[0],
      preferences_data: typeof result.rows[0].preferences_data === 'string' 
        ? JSON.parse(result.rows[0].preferences_data) 
        : result.rows[0].preferences_data
    };
  }
  return null;
}

export async function close() {
  await pool.end();
} 