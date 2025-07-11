/**
 * Vercel API Endpoint for Enhanced Data Migration
 * Allows running the migration script via HTTP request
 * 
 * Usage: POST /api/migrate-enhanced-data
 * Headers: { "Authorization": "Bearer YOUR_ADMIN_TOKEN" }
 * Body: { "confirm": true }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple admin token check (use a strong secret in production)
const ADMIN_TOKEN = process.env.ADMIN_MIGRATION_TOKEN || 'change-this-secret';

// Database connection setup (same logic as db-neon.js)
function getDatabaseUrl() {
  if (process.env.POSTGRES_POSTGRES_URL) {
    return process.env.POSTGRES_POSTGRES_URL;
  }
  
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  const host = process.env.POSTGRES_POSTGRES_HOST;
  const user = process.env.POSTGRES_POSTGRES_USER;
  const password = process.env.POSTGRES_POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_POSTGRES_DATABASE;
  
  if (host && user && password && database) {
    return `postgresql://${user}:${password}@${host}/${database}?sslmode=require`;
  }
  
  return null;
}

// Migration schema for POI and spatial data
const MIGRATION_SCHEMA = `
-- Enhanced POI Master Table
CREATE TABLE IF NOT EXISTS kb_poi_master (
  id SERIAL PRIMARY KEY,
  place_id VARCHAR(255) UNIQUE,
  legacy_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  primary_type VARCHAR(100),
  secondary_types TEXT[],
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  municipality VARCHAR(100),
  district VARCHAR(100),
  plus_code VARCHAR(20),
  rating DECIMAL(3, 2),
  rating_count INTEGER,
  price_level INTEGER,
  phone VARCHAR(50),
  website TEXT,
  opening_hours JSONB,
  amenities TEXT[],
  tags TEXT[],
  description TEXT,
  highlights TEXT[],
  local_tips TEXT[],
  best_times TEXT[],
  seasonal_variations JSONB,
  accessibility_features TEXT[],
  data_sources TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Spatial Relationships for Agent Intelligence
CREATE TABLE IF NOT EXISTS kb_spatial_relationships (
  id SERIAL PRIMARY KEY,
  poi_from INTEGER REFERENCES kb_poi_master(id) ON DELETE CASCADE,
  poi_to INTEGER REFERENCES kb_poi_master(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  distance_meters INTEGER,
  travel_time_walking INTEGER,
  travel_time_driving INTEGER,
  path_type VARCHAR(50),
  confidence_score DECIMAL(3,2),
  seasonal_accessibility JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(poi_from, poi_to, relationship_type)
);

-- POI Clusters for Area Context
CREATE TABLE IF NOT EXISTS kb_poi_clusters (
  id SERIAL PRIMARY KEY,
  cluster_name VARCHAR(255) NOT NULL,
  cluster_type VARCHAR(50),
  center_latitude DECIMAL(10, 8),
  center_longitude DECIMAL(11, 8),
  radius_meters INTEGER,
  poi_count INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cluster Membership
CREATE TABLE IF NOT EXISTS kb_poi_cluster_members (
  id SERIAL PRIMARY KEY,
  cluster_id INTEGER REFERENCES kb_poi_clusters(id) ON DELETE CASCADE,
  poi_id INTEGER REFERENCES kb_poi_master(id) ON DELETE CASCADE,
  membership_strength DECIMAL(3,2) DEFAULT 1.0,
  
  UNIQUE(cluster_id, poi_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_poi_master_location ON kb_poi_master(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_poi_master_type ON kb_poi_master(primary_type);
CREATE INDEX IF NOT EXISTS idx_poi_master_place_id ON kb_poi_master(place_id);
CREATE INDEX IF NOT EXISTS idx_spatial_rel_from ON kb_spatial_relationships(poi_from);
CREATE INDEX IF NOT EXISTS idx_spatial_rel_to ON kb_spatial_relationships(poi_to);
CREATE INDEX IF NOT EXISTS idx_spatial_rel_type ON kb_spatial_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_cluster_members_poi ON kb_poi_cluster_members(poi_id);
CREATE INDEX IF NOT EXISTS idx_cluster_members_cluster ON kb_poi_cluster_members(cluster_id);
`;

// Helper function to execute SQL with error handling
async function executeSQL(client, sql, description) {
  try {
    console.log(`📝 ${description}...`);
    await client.query(sql);
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

// Load JSON data files - using proper paths for Vercel
function loadDataFile(filename) {
  // Try multiple path strategies for Vercel deployment
  const possiblePaths = [
    path.join(process.cwd(), filename),
    path.join(__dirname, '..', filename),
    path.join('/var/task', filename)
  ];
  
  let filepath = null;
  let data = null;
  
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      filepath = testPath;
      break;
    }
  }
  
  if (!filepath) {
    throw new Error(`Data file not found: ${filename}. Tried paths: ${possiblePaths.join(', ')}`);
  }
  
  console.log(`📄 Loading ${filename} from ${filepath}...`);
  data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  console.log(`✅ Loaded ${Array.isArray(data) ? data.length : Object.keys(data).length} records from ${filename}`);
  
  return data;
}

// Transform POI data for PostgreSQL insertion
function transformPOIForDB(poi) {
  return {
    place_id: poi.place_id || poi.legacy_id || null,
    legacy_id: poi.legacy_id || null,
    name: poi.name,
    primary_type: poi.primary_type,
    secondary_types: poi.secondary_types || [],
    latitude: parseFloat(poi.latitude),
    longitude: parseFloat(poi.longitude),
    address: poi.address || null,
    municipality: poi.municipality || null,
    district: poi.district || null,
    plus_code: poi.plus_code || null,
    rating: poi.rating ? parseFloat(poi.rating) : null,
    rating_count: poi.rating_count ? parseInt(poi.rating_count) : null,
    price_level: poi.price_level ? parseInt(poi.price_level) : null,
    phone: poi.phone || null,
    website: poi.website || null,
    opening_hours: poi.opening_hours ? JSON.stringify(poi.opening_hours) : null,
    amenities: poi.amenities || [],
    tags: poi.tags || [],
    description: poi.description || null,
    highlights: poi.highlights || [],
    local_tips: poi.local_tips || [],
    best_times: poi.best_times || [],
    seasonal_variations: poi.seasonal_variations ? JSON.stringify(poi.seasonal_variations) : null,
    accessibility_features: poi.accessibility_features || [],
    data_sources: poi.data_sources || []
  };
}

// Main migration function
async function runMigration() {
  const DATABASE_URL = getDatabaseUrl();
  if (!DATABASE_URL) {
    throw new Error('PostgreSQL connection environment variables are required');
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  const client = await pool.connect();
  
  try {
    console.log('🏗️ Setting up database schema...');
    await executeSQL(client, MIGRATION_SCHEMA, 'Creating enhanced POI schema');
    
    // Load enhanced POI dataset
    console.log('\n📊 Loading enhanced POI dataset...');
    const enhancedPOIData = loadDataFile('output/enhanced_pois_with_beaches.json');
    
    // Handle both array format and object with pois property
    const enhancedPOIs = Array.isArray(enhancedPOIData) ? enhancedPOIData : enhancedPOIData.pois || [];
    
    // Clear existing data
    console.log('\n🧹 Clearing existing POI data...');
    await executeSQL(client, 'TRUNCATE TABLE kb_poi_cluster_members, kb_poi_clusters, kb_spatial_relationships, kb_poi_master RESTART IDENTITY CASCADE', 'Clearing existing data');
    
    // Insert POIs in batches
    console.log('\n📥 Inserting enhanced POI data...');
    const batchSize = 50; // Smaller batches for Vercel
    let insertedCount = 0;
    
    for (let i = 0; i < enhancedPOIs.length; i += batchSize) {
      const batch = enhancedPOIs.slice(i, i + batchSize);
      const values = [];
      const params = [];
      let paramIndex = 1;
      
      for (const poi of batch) {
        const transformed = transformPOIForDB(poi);
        const poiValues = [];
        
        // Build parameterized query
        Object.values(transformed).forEach(value => {
          poiValues.push(`$${paramIndex}`);
          params.push(value);
          paramIndex++;
        });
        
        values.push(`(${poiValues.join(', ')})`);
      }
      
      const insertQuery = `
        INSERT INTO kb_poi_master (
          place_id, legacy_id, name, primary_type, secondary_types,
          latitude, longitude, address, municipality, district, plus_code,
          rating, rating_count, price_level, phone, website, opening_hours,
          amenities, tags, description, highlights, local_tips, best_times,
          seasonal_variations, accessibility_features, data_sources
        ) VALUES ${values.join(', ')}
        ON CONFLICT (place_id) DO UPDATE SET
          name = EXCLUDED.name,
          primary_type = EXCLUDED.primary_type,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(insertQuery, params);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.ceil((i + batchSize) / batchSize)} - Total: ${insertedCount}/${enhancedPOIs.length} POIs`);
    }
    
    // Load and insert spatial relationships (simplified for API)
    console.log('\n🔗 Processing spatial relationships...');
    
    try {
      const spatialData = loadDataFile('data/spatial_relationships.json');
      
      if (spatialData.spatial_relationships && spatialData.spatial_relationships.length > 0) {
        const relationships = spatialData.spatial_relationships.slice(0, 1000); // Limit for serverless
        let relInsertedCount = 0;
        
        for (const rel of relationships) {
          try {
            // Find POI IDs by place_id or legacy_id
            const fromResult = await client.query(
              'SELECT id FROM kb_poi_master WHERE place_id = $1 OR legacy_id = $1 LIMIT 1',
              [rel.poi_from]
            );
            const toResult = await client.query(
              'SELECT id FROM kb_poi_master WHERE place_id = $1 OR legacy_id = $1 LIMIT 1',
              [rel.poi_to]
            );
            
            if (fromResult.rows.length > 0 && toResult.rows.length > 0) {
              await client.query(`
                INSERT INTO kb_spatial_relationships (
                  poi_from, poi_to, relationship_type, distance_meters,
                  travel_time_walking, confidence_score
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (poi_from, poi_to, relationship_type) DO NOTHING
              `, [
                fromResult.rows[0].id,
                toResult.rows[0].id,
                rel.relationship_type,
                rel.distance_meters,
                rel.travel_time_walking,
                rel.confidence_score || 0.8
              ]);
              relInsertedCount++;
            }
          } catch (error) {
            // Skip invalid relationships
          }
        }
        
        console.log(`✅ Inserted ${relInsertedCount} spatial relationships`);
      }
    } catch (error) {
      console.warn('⚠️ Spatial relationships processing skipped:', error.message);
    }
    
    // Final statistics
    const poiCount = await client.query('SELECT COUNT(*) as count FROM kb_poi_master');
    const relationshipCount = await client.query('SELECT COUNT(*) as count FROM kb_spatial_relationships');
    
    console.log(`✅ Migration completed: ${poiCount.rows[0].count} POIs, ${relationshipCount.rows[0].count} relationships`);
    
    return {
      pois: parseInt(poiCount.rows[0].count),
      relationships: parseInt(relationshipCount.rows[0].count)
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

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
    const results = await runMigration();
    
    console.log('✅ Migration completed successfully via API');
    
    return res.status(200).json({
      success: true,
      message: 'Enhanced data migration completed successfully',
      timestamp: new Date().toISOString(),
      data: {
        pois: results.pois,
        relationships: results.relationships,
        status: 'Migration completed'
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