#!/usr/bin/env node

/**
 * Production Migration Runner via API
 * Runs the enhanced data migration on your Vercel production environment
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const DOMAIN = process.env.DOMAIN || process.env.VERCEL_URL;
const ADMIN_TOKEN = process.env.ADMIN_MIGRATION_TOKEN;

if (!DOMAIN) {
  console.error('❌ DOMAIN environment variable required');
  console.error('   Set DOMAIN=https://your-app.vercel.app in your .env file');
  process.exit(1);
}

if (!ADMIN_TOKEN) {
  console.error('❌ ADMIN_MIGRATION_TOKEN environment variable required');
  console.error('   Set ADMIN_MIGRATION_TOKEN=your-secret-token in your .env file');
  process.exit(1);
}

console.log('🚀 Running production migration via API...');
console.log(`📍 Target: ${DOMAIN}`);

async function runMigration() {
  try {
    const response = await fetch(`${DOMAIN}/api/migrate-enhanced-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      },
      body: JSON.stringify({ confirm: true })
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Migration completed successfully!');
      console.log('📊 Result:', JSON.stringify(result, null, 2));
    } else {
      console.error('❌ Migration failed:');
      console.error('📋 Response:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Migration request failed:', error.message);
    process.exit(1);
  }
}

async function verifyMigration() {
  try {
    console.log('\n🔍 Verifying migration...');
    
    const response = await fetch(`${DOMAIN}/api/verify-enhanced-data`);
    const result = await response.json();

    console.log('📊 Verification Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.status === 'ready') {
      console.log('\n🎉 Enhanced POI system is ready and operational!');
    } else {
      console.log('\n⚠️ System may need additional configuration');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

// Run migration and verification
runMigration()
  .then(() => verifyMigration())
  .catch((error) => {
    console.error('💥 Process failed:', error);
    process.exit(1);
  }); 