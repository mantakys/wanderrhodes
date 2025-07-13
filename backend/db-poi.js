/**
 * POI Database Functions
 * Handles Enhanced POI and Spatial Relationship Queries for Production
 * Integrates with existing db-adapter.js system
 */

import pkg from 'pg';
const { Pool } = pkg;

// Use same database connection logic as db-neon.js
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
let pool = null;

// Initialize connection pool only if PostgreSQL is available
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
} else {
  console.log('⚠️ POI database functions not available - PostgreSQL not configured');
}

// Helper function to execute queries
async function executeQuery(query, params = []) {
  if (!pool) {
    throw new Error('PostgreSQL not configured - POI queries not available');
  }
  
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result;
  } finally {
    client.release();
  }
}

// Check if POI tables exist and are populated
export async function isPOIDataAvailable() {
  if (!pool) return false;
  
  try {
    const result = await executeQuery(`
      SELECT 
        (SELECT COUNT(*) FROM kb_poi_master) as poi_count,
        (SELECT COUNT(*) FROM kb_spatial_relationships) as relationship_count
    `);
    
    const { poi_count, relationship_count } = result.rows[0];
    return parseInt(poi_count) > 0 && parseInt(relationship_count) > 0;
  } catch (error) {
    console.warn('⚠️ POI data availability check failed:', error.message);
    return false;
  }
}

// Search POIs by type and location
export async function searchPOIsByType(type, latitude, longitude, radius = 5000, limit = 20) {
  const query = `
    SELECT 
      id, place_id, name, primary_type, latitude, longitude,
      address, rating, price_level, phone, website,
      amenities, tags, description, highlights, local_tips,
      -- Calculate distance in meters using haversine formula
      (6371000 * acos(
        cos(radians($2)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($3)) + 
        sin(radians($2)) * sin(radians(latitude))
      )) AS distance_meters
    FROM kb_poi_master 
    WHERE primary_type = $1
      AND (6371000 * acos(
        cos(radians($2)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($3)) + 
        sin(radians($2)) * sin(radians(latitude))
      )) <= $4
    ORDER BY distance_meters ASC
    LIMIT $5
  `;
  
  const result = await executeQuery(query, [type, latitude, longitude, radius, limit]);
  return result.rows;
}

// Get POIs near a specific location
export async function getNearbyPOIs(latitude, longitude, radius = 1000, types = null, limit = 10) {
  let query = `
    SELECT 
      id, place_id, name, primary_type, latitude, longitude,
      address, rating, price_level, amenities, tags, description,
      (6371000 * acos(
        cos(radians($1)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($2)) + 
        sin(radians($1)) * sin(radians(latitude))
      )) AS distance_meters
    FROM kb_poi_master 
    WHERE (6371000 * acos(
      cos(radians($1)) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians($2)) + 
      sin(radians($1)) * sin(radians(latitude))
    )) <= $3
  `;
  
  const params = [latitude, longitude, radius];
  
  if (types && types.length > 0) {
    query += ` AND primary_type = ANY($4)`;
    params.push(types);
  }
  
  query += ` ORDER BY distance_meters ASC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const result = await executeQuery(query, params);
  return result.rows;
}

// Get spatial relationships for a POI
export async function getSpatialRelationships(poiId, relationshipTypes = null, limit = 50) {
  let query = `
    SELECT 
      sr.relationship_type,
      sr.distance_meters,
      sr.travel_time_walking,
      sr.travel_time_driving,
      sr.confidence_score,
      p.id as related_poi_id,
      p.name as related_poi_name,
      p.primary_type as related_poi_type,
      p.latitude as related_poi_lat,
      p.longitude as related_poi_lng,
      p.address as related_poi_address,
      p.rating as related_poi_rating
    FROM kb_spatial_relationships sr
    JOIN kb_poi_master p ON sr.poi_to = p.id
    WHERE sr.poi_from = $1
  `;
  
  const params = [poiId];
  
  if (relationshipTypes && relationshipTypes.length > 0) {
    query += ` AND sr.relationship_type = ANY($2)`;
    params.push(relationshipTypes);
  }
  
  query += ` ORDER BY sr.confidence_score DESC, sr.distance_meters ASC LIMIT $${params.length + 1}`;
  params.push(limit);
  
  const result = await executeQuery(query, params);
  return result.rows;
}

// Find POIs that are adjacent to a given POI
export async function getAdjacentPOIs(poiId, limit = 10) {
  return getSpatialRelationships(poiId, ['adjacent_to'], limit);
}

// Find POIs within walking distance
export async function getWalkingDistancePOIs(poiId, limit = 20) {
  return getSpatialRelationships(poiId, ['walking_distance'], limit);
}

// Get POI clusters in an area
export async function getPOIClustersNear(latitude, longitude, radius = 2000) {
  const query = `
    SELECT 
      c.id, c.cluster_name, c.cluster_type, c.description,
      c.center_latitude, c.center_longitude, c.poi_count,
      (6371000 * acos(
        cos(radians($1)) * cos(radians(c.center_latitude)) * 
        cos(radians(c.center_longitude) - radians($2)) + 
        sin(radians($1)) * sin(radians(c.center_latitude))
      )) AS distance_meters
    FROM kb_poi_clusters c
    WHERE (6371000 * acos(
      cos(radians($1)) * cos(radians(c.center_latitude)) * 
      cos(radians(c.center_longitude) - radians($2)) + 
      sin(radians($1)) * sin(radians(c.center_latitude))
    )) <= $3
    ORDER BY distance_meters ASC
  `;
  
  const result = await executeQuery(query, [latitude, longitude, radius]);
  return result.rows;
}

/**
 * Get POIs by multiple criteria (enhanced search)
 * @param {Object} criteria
 * @param {string[]=} criteria.types
 * @param {number=} criteria.latitude
 * @param {number=} criteria.longitude
 * @param {number=} criteria.radius
 * @param {number=} criteria.minRating
 * @param {number=} criteria.priceLevel
 * @param {string[]=} criteria.amenities
 * @param {string[]=} criteria.tags
 * @param {string=} criteria.searchText
 * @param {number=} criteria.limit
 * @param {string[]=} criteria.excludeIds - Array of POI ids to exclude
 * @param {string[]=} criteria.excludeNames - Array of POI names to exclude
 */
export async function searchPOIsAdvanced(criteria) {
  const {
    types = null,
    latitude = null,
    longitude = null,
    radius = 10000,
    minRating = null,
    priceLevel = null,
    amenities = null,
    tags = null,
    searchText = null,
    limit = 20,
    excludeIds = null,
    excludeNames = null
  } = criteria;
  
  let query = `
    SELECT 
      id, place_id, name, primary_type, latitude, longitude,
      address, rating, price_level, amenities, tags, description,
      highlights, local_tips
  `;
  
  const params = [];
  let paramIndex = 1;
  
  // Add distance calculation if location provided
  if (latitude && longitude) {
    query += `, (6371000 * acos(
      cos(radians($${paramIndex})) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians($${paramIndex + 1})) + 
      sin(radians($${paramIndex})) * sin(radians(latitude))
    )) AS distance_meters`;
    params.push(latitude, longitude);
    paramIndex += 2;
  }
  
  query += ` FROM kb_poi_master WHERE 1=1`;
  
  // Add filters
  if (types && types.length > 0) {
    query += ` AND primary_type = ANY($${paramIndex})`;
    params.push(types);
    paramIndex++;
  }
  
  if (latitude && longitude && radius) {
    query += ` AND (6371000 * acos(
      cos(radians($${params.indexOf(latitude) + 1})) * cos(radians(latitude)) * 
      cos(radians(longitude) - radians($${params.indexOf(longitude) + 1})) + 
      sin(radians($${params.indexOf(latitude) + 1})) * sin(radians(latitude))
    )) <= $${paramIndex}`;
    params.push(radius);
    paramIndex++;
  }
  
  if (minRating) {
    query += ` AND rating >= $${paramIndex}`;
    params.push(minRating);
    paramIndex++;
  }
  
  if (priceLevel) {
    query += ` AND price_level <= $${paramIndex}`;
    params.push(priceLevel);
    paramIndex++;
  }
  
  if (amenities && amenities.length > 0) {
    query += ` AND amenities && $${paramIndex}`;
    params.push(amenities);
    paramIndex++;
  }
  
  if (tags && tags.length > 0) {
    query += ` AND tags && $${paramIndex}`;
    params.push(tags);
    paramIndex++;
  }
  
  if (searchText) {
    query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
    params.push(`%${searchText}%`);
    paramIndex++;
  }

  if (excludeIds && excludeIds.length > 0) {
    query += ` AND id <> ALL($${paramIndex})`;
    params.push(excludeIds);
    paramIndex++;
  }

  if (excludeNames && excludeNames.length > 0) {
    query += ` AND name <> ALL($${paramIndex})`;
    params.push(excludeNames);
    paramIndex++;
  }
  
  // Order by distance if location provided, otherwise by rating
  if (latitude && longitude) {
    query += ` ORDER BY distance_meters ASC`;
  } else {
    query += ` ORDER BY rating DESC NULLS LAST`;
  }
  
  query += ` LIMIT $${paramIndex}`;
  params.push(limit);
  
  const result = await executeQuery(query, params);
  return result.rows;
}

// Get POI statistics for debugging
export async function getPOIStatistics() {
  const queries = [
    'SELECT COUNT(*) as total_pois FROM kb_poi_master',
    'SELECT COUNT(*) as total_relationships FROM kb_spatial_relationships',
    'SELECT primary_type, COUNT(*) as count FROM kb_poi_master GROUP BY primary_type ORDER BY count DESC LIMIT 10',
    'SELECT relationship_type, COUNT(*) as count FROM kb_spatial_relationships GROUP BY relationship_type ORDER BY count DESC'
  ];
  
  const results = {};
  
  try {
    const [totalPOIs, totalRels, typeStats, relStats] = await Promise.all(
      queries.map(query => executeQuery(query))
    );
    
    results.totalPOIs = parseInt(totalPOIs.rows[0].total_pois);
    results.totalRelationships = parseInt(totalRels.rows[0].total_relationships);
    results.topTypes = typeStats.rows;
    results.relationshipTypes = relStats.rows;
    
  } catch (error) {
    console.error('Error getting POI statistics:', error);
    results.error = error.message;
  }
  
  return results;
}

// Find the best POI match by name and location (for geocoding integration)
export async function findPOIByNameAndLocation(name, latitude, longitude, maxDistance = 1000) {
  const query = `
    SELECT 
      id, place_id, name, primary_type, latitude, longitude,
      address, rating, amenities, tags, description,
      (6371000 * acos(
        cos(radians($2)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($3)) + 
        sin(radians($2)) * sin(radians(latitude))
      )) AS distance_meters
    FROM kb_poi_master 
    WHERE name ILIKE $1
      AND (6371000 * acos(
        cos(radians($2)) * cos(radians(latitude)) * 
        cos(radians(longitude) - radians($3)) + 
        sin(radians($2)) * sin(radians(latitude))
      )) <= $4
    ORDER BY 
      CASE WHEN LOWER(name) = LOWER($1) THEN 1 ELSE 2 END,
      distance_meters ASC
    LIMIT 1
  `;
  
  const result = await executeQuery(query, [`%${name}%`, latitude, longitude, maxDistance]);
  return result.rows[0] || null;
}

// Close database connection
export async function closePOIDatabase() {
  if (pool) {
    await pool.end();
  }
}

// Export availability check for use in other modules
export { isPOIDataAvailable as isAvailable }; 