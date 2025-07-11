#!/usr/bin/env node

/**
 * Validation Script for Enhanced Data Migration
 * Checks data files and structure before running production migration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔍 Validating migration data files...\n');

// Function to check file exists and get size
function validateFile(filepath, description) {
  const fullPath = path.join(__dirname, '..', filepath);
  
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ ${description}: File not found at ${filepath}`);
    return null;
  }
  
  const stats = fs.statSync(fullPath);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`✅ ${description}: Found (${sizeMB} MB)`);
  
  try {
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    return { data, size: stats.size, path: fullPath };
  } catch (error) {
    console.error(`❌ ${description}: Invalid JSON - ${error.message}`);
    return null;
  }
}

// Validate enhanced POI dataset
console.log('📍 Validating Enhanced POI Dataset:');
const poiFile = validateFile('output/enhanced_pois_with_beaches.json', 'Enhanced POIs');

if (poiFile) {
  const poiData = poiFile.data;
  
  // Handle both array format and object with pois property
  const pois = Array.isArray(poiData) ? poiData : poiData.pois || [];
  
  console.log(`   📊 Total POIs: ${pois.length}`);
  
  // Validate POI structure
  if (pois.length > 0) {
    const samplePOI = pois[0];
    const requiredFields = ['name', 'latitude', 'longitude', 'primary_type'];
    const missingFields = requiredFields.filter(field => !samplePOI.hasOwnProperty(field));
    
    if (missingFields.length > 0) {
      console.error(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
    } else {
      console.log('   ✅ POI structure valid');
    }
    
    // Count by type
    const typeCount = {};
    pois.forEach(poi => {
      const type = poi.primary_type || 'unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    const topTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    console.log('   📈 Top POI Types:');
    topTypes.forEach(([type, count], index) => {
      console.log(`      ${index + 1}. ${type}: ${count}`);
    });
  }
}

// Validate spatial relationships
console.log('\n🔗 Validating Spatial Relationships:');
const spatialFile = validateFile('data/spatial_relationships.json', 'Spatial Relationships');

if (spatialFile) {
  const spatialData = spatialFile.data;
  
  if (spatialData.spatial_relationships && Array.isArray(spatialData.spatial_relationships)) {
    const relationships = spatialData.spatial_relationships;
    console.log(`   📊 Total Relationships: ${relationships.length}`);
    
    // Validate relationship structure
    if (relationships.length > 0) {
      const sampleRel = relationships[0];
      const requiredFields = ['poi_from', 'poi_to', 'relationship_type'];
      const missingFields = requiredFields.filter(field => !sampleRel.hasOwnProperty(field));
      
      if (missingFields.length > 0) {
        console.error(`   ❌ Missing required fields: ${missingFields.join(', ')}`);
      } else {
        console.log('   ✅ Relationship structure valid');
      }
      
      // Count by relationship type
      const relTypeCount = {};
      relationships.forEach(rel => {
        const type = rel.relationship_type || 'unknown';
        relTypeCount[type] = (relTypeCount[type] || 0) + 1;
      });
      
      console.log('   📈 Relationship Types:');
      Object.entries(relTypeCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`      • ${type}: ${count}`);
        });
    }
  } else {
    console.error('   ❌ Invalid spatial relationships structure');
  }
  
  // Check for clusters if available
  if (spatialData.poi_clusters && Array.isArray(spatialData.poi_clusters)) {
    console.log(`   📊 POI Clusters: ${spatialData.poi_clusters.length}`);
  }
}

// Environment variable check
console.log('\n🔧 Environment Variables Check:');

const envVars = [
  'POSTGRES_POSTGRES_URL',
  'POSTGRES_POSTGRES_HOST', 
  'POSTGRES_POSTGRES_USER',
  'POSTGRES_POSTGRES_PASSWORD',
  'POSTGRES_POSTGRES_DATABASE',
  'DATABASE_URL'
];

let hasPostgresConfig = false;

envVars.forEach(varName => {
  if (process.env[varName]) {
    console.log(`   ✅ ${varName}: Set`);
    hasPostgresConfig = true;
  } else {
    console.log(`   ⚠️ ${varName}: Not set`);
  }
});

if (!hasPostgresConfig) {
  console.error('\n❌ No PostgreSQL environment variables found!');
  console.error('   Required: POSTGRES_POSTGRES_URL or individual POSTGRES_POSTGRES_* components');
  process.exit(1);
} else {
  console.log('\n✅ PostgreSQL configuration detected');
}

// Migration readiness summary
console.log('\n🎯 Migration Readiness Summary:');

const checks = {
  'POI Data File': !!poiFile,
  'Spatial Data File': !!spatialFile,
  'PostgreSQL Config': hasPostgresConfig,
  'Data Structure': poiFile && spatialFile
};

const allPassed = Object.values(checks).every(check => check);

Object.entries(checks).forEach(([check, passed]) => {
  console.log(`   ${passed ? '✅' : '❌'} ${check}`);
});

if (allPassed) {
  console.log('\n🚀 Ready for migration! You can run:');
  console.log('   npm run migrate:enhanced-data');
  console.log('\n⚠️  Note: This will replace existing POI data in your database');
} else {
  console.log('\n❌ Migration not ready. Please fix the issues above.');
  process.exit(1);
}

console.log('\n📋 Next steps after migration:');
console.log('   1. Run: npm run verify:database');
console.log('   2. Run: npm run test:poi-data');
console.log('   3. Test enhanced chat features'); 