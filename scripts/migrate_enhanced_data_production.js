#!/usr/bin/env node

/**
 * Production Data Migration Script
 * Migrates enhanced POI dataset and spatial relationships to PostgreSQL
 * Works with POSTGRES_POSTGRES_* environment variables
 * RUNS LOCALLY - connects to production database with local data files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
import dotenv from 'dotenv';

const { Pool } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();

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

const DATABASE_URL = getDatabaseUrl();
if (!DATABASE_URL) {
  console.error('❌ PostgreSQL connection environment variables are required');
  console.error('Required: POSTGRES_POSTGRES_URL or individual POSTGRES_POSTGRES_* components');
  process.exit(1);
}

console.log('🚀 Starting enhanced data migration to production PostgreSQL...');
console.log('🔗 Database URL detected:', DATABASE_URL ? 'Set' : 'Missing');
console.log('📁 Running locally with access to data files...');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
});

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

// Load JSON data files
function loadDataFile(filename) {
  const filepath = path.join(__dirname, '..', filename);
  
  if (!fs.existsSync(filepath)) {
    throw new Error(`Data file not found: ${filepath}`);
  }
  
  console.log(`📄 Loading ${filename}...`);
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
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
  const client = await pool.connect();
  
  try {
    console.log('🏗️ Setting up database schema...');
    await executeSQL(client, MIGRATION_SCHEMA, 'Creating enhanced POI schema');
    
    // Load enhanced POI dataset
    console.log('\n📊 Loading enhanced POI dataset...');
    const enhancedPOIData = loadDataFile('output/enhanced_pois_with_beaches.json');
    
    // Handle both array format and object with pois property
    const enhancedPOIs = Array.isArray(enhancedPOIData) ? enhancedPOIData : enhancedPOIData.pois || [];
    
    // Clear existing data (optional - comment out to preserve existing data)
    console.log('\n🧹 Clearing existing POI data...');
    await executeSQL(client, 'TRUNCATE TABLE kb_poi_cluster_members, kb_poi_clusters, kb_spatial_relationships, kb_poi_master RESTART IDENTITY CASCADE', 'Clearing existing data');
    
    // Insert POIs in batches
    console.log('\n📥 Inserting enhanced POI data...');
    const batchSize = 100;
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
          if (Array.isArray(value)) {
            poiValues.push(`$${paramIndex}`);
            params.push(value);
          } else {
            poiValues.push(`$${paramIndex}`);
            params.push(value);
          }
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
          secondary_types = EXCLUDED.secondary_types,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await client.query(insertQuery, params);
      insertedCount += batch.length;
      console.log(`✅ Inserted batch ${Math.ceil((i + batchSize) / batchSize)} - Total: ${insertedCount}/${enhancedPOIs.length} POIs`);
    }
    
    // Load and insert spatial relationships
    console.log('\n🔗 Loading spatial relationships...');
    
    try {
      const spatialData = loadDataFile('data/spatial_relationships.json');
      
      if (spatialData.spatial_relationships && spatialData.spatial_relationships.length > 0) {
        console.log('\n📥 Inserting spatial relationships...');
        
        const relationships = spatialData.spatial_relationships;
        const relBatchSize = 500;
        let relInsertedCount = 0;
        
        for (let i = 0; i < relationships.length; i += relBatchSize) {
          const batch = relationships.slice(i, i + relBatchSize);
          
          for (const rel of batch) {
            try {
              // Find POI IDs by place_id or legacy_id
              const fromResult = await client.query(
                'SELECT id FROM kb_poi_master WHERE place_id = $1 OR legacy_id = $1',
                [rel.poi_from]
              );
              const toResult = await client.query(
                'SELECT id FROM kb_poi_master WHERE place_id = $1 OR legacy_id = $1',
                [rel.poi_to]
              );
              
              if (fromResult.rows.length > 0 && toResult.rows.length > 0) {
                await client.query(`
                  INSERT INTO kb_spatial_relationships (
                    poi_from, poi_to, relationship_type, distance_meters,
                    travel_time_walking, travel_time_driving, path_type, confidence_score
                  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                  ON CONFLICT (poi_from, poi_to, relationship_type) DO NOTHING
                `, [
                  fromResult.rows[0].id,
                  toResult.rows[0].id,
                  rel.relationship_type,
                  rel.distance_meters,
                  rel.travel_time_walking,
                  rel.travel_time_driving,
                  rel.path_type,
                  rel.confidence_score
                ]);
                relInsertedCount++;
              }
            } catch (error) {
              // Skip invalid relationships
              console.warn(`⚠️ Skipping invalid relationship: ${rel.poi_from} -> ${rel.poi_to}`);
            }
          }
          
          console.log(`✅ Processed spatial relationship batch ${Math.ceil((i + relBatchSize) / relBatchSize)} - Total: ${relInsertedCount} relationships`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Spatial relationships file not found or invalid, skipping...');
    }
    
    // Final statistics
    console.log('\n📊 Migration completed! Gathering statistics...');
    
    const poiCount = await client.query('SELECT COUNT(*) as count FROM kb_poi_master');
    const relationshipCount = await client.query('SELECT COUNT(*) as count FROM kb_spatial_relationships');
    const typeStats = await client.query(`
      SELECT primary_type, COUNT(*) as count 
      FROM kb_poi_master 
      GROUP BY primary_type 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    console.log('\n🎉 MIGRATION SUMMARY:');
    console.log(`📍 Total POIs: ${poiCount.rows[0].count}`);
    console.log(`🔗 Total Spatial Relationships: ${relationshipCount.rows[0].count}`);
    console.log('\n📈 Top POI Categories:');
    typeStats.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.primary_type}: ${row.count}`);
    });
    
    console.log('\n✅ Enhanced data migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigration()
    .then(() => {
      console.log('\n🎯 Migration completed successfully!');
      console.log('🔗 Verify by running: npm run verify:production');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    })
    .finally(() => {
      pool.end();
    });
}

export { runMigration }; 