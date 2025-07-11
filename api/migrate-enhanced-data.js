/**
 * Vercel API Endpoint for Enhanced Data Migration
 * Allows running the migration script via HTTP request
 * 
 * Usage: POST /api/migrate-enhanced-data
 * Headers: { "Authorization": "Bearer YOUR_ADMIN_TOKEN" }
 * Body: { "confirm": true }
 */

import { runMigration } from '../scripts/migrate_enhanced_data_production.js';

// Simple admin token check (use a strong secret in production)
const ADMIN_TOKEN = process.env.ADMIN_MIGRATION_TOKEN || 'change-this-secret';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are allowed' 
    });
  }

  // Check authorization
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Valid admin token required' 
    });
  }

  // Check confirmation
  const { confirm } = req.body;
  if (!confirm) {
    return res.status(400).json({
      error: 'Confirmation required',
      message: 'Set "confirm": true in request body to proceed',
      warning: 'This will replace existing POI data in the database'
    });
  }

  try {
    console.log('🚀 Starting enhanced data migration via API...');
    
    // Run the migration
    await runMigration();
    
    console.log('✅ Migration completed successfully via API');
    
    return res.status(200).json({
      success: true,
      message: 'Enhanced data migration completed successfully',
      timestamp: new Date().toISOString(),
      data: {
        pois: 'Migrated enhanced POI dataset',
        relationships: 'Migrated spatial relationships',
        clusters: 'Migrated POI clusters'
      }
    });

  } catch (error) {
    console.error('❌ Migration failed via API:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// API route configuration for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  // Increase timeout for migration (max 60s for hobby plan)
  maxDuration: 60,
} 