import axios from 'axios';

// Rhodes bounds for validation
const RHODES_BOUNDS = {
  north: 36.5,
  south: 36.0,
  east: 28.4,
  west: 27.8
};

// Simple in-memory cache
const geocodeCache = new Map();
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

function getCachedCoordinates(locationName) {
  const cached = geocodeCache.get(locationName);
  if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
    console.log(`🗺️ Cache hit for geocoding: ${locationName}`);
    return cached.coordinates;
  }
  return null;
}

function setCachedCoordinates(locationName, coordinates) {
  geocodeCache.set(locationName, {
    coordinates,
    timestamp: Date.now()
  });
}

// Validate coordinates are within Rhodes bounds
function isValidRhodesCoordinates(lat, lng) {
  return lat >= RHODES_BOUNDS.south && 
         lat <= RHODES_BOUNDS.north && 
         lng >= RHODES_BOUNDS.west && 
         lng <= RHODES_BOUNDS.east;
}

/**
 * Geocode using Google Places API (New Places API with location bias)
 */
async function geocodeWithGoogle(locationName) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.log('🗺️ Google Maps API key not available');
    return null;
  }

  try {
    console.log(`🗺️ Geocoding with Google Places: ${locationName}`);
    
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: locationName,
        locationBias: {
          circle: {
            center: { latitude: 36.4341, longitude: 28.2176 }, // Rhodes center
            radius: 50000 // 50km radius
          }
        },
        maxResultCount: 1
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'places.location,places.displayName'
        },
        timeout: 8000
      }
    );

    const place = response.data?.places?.[0];
    if (place?.location) {
      const { latitude, longitude } = place.location;
      
      if (isValidRhodesCoordinates(latitude, longitude)) {
        console.log(`✅ Google geocoding successful: ${locationName} -> ${latitude}, ${longitude}`);
        return { lat: latitude, lng: longitude };
      } else {
        console.log(`⚠️ Google coordinates outside Rhodes bounds: ${latitude}, ${longitude}`);
        return null;
      }
    }

    console.log(`❌ No location found in Google Places for: ${locationName}`);
    return null;
  } catch (error) {
    console.error(`❌ Google geocoding error for ${locationName}:`, error.message);
    return null;
  }
}

/**
 * Geocode using Mapbox as fallback
 */
async function geocodeWithMapbox(locationName) {
  if (!process.env.MAPBOX_ACCESS_TOKEN) {
    console.log('🗺️ Mapbox access token not available');
    return null;
  }

  try {
    console.log(`🗺️ Geocoding with Mapbox: ${locationName}`);
    
    // Add Rhodes context to improve accuracy
    const query = `${locationName}, Rhodes, Greece`;
    const encodedQuery = encodeURIComponent(query);
    
    const response = await axios.get(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json`,
      {
        params: {
          access_token: process.env.MAPBOX_ACCESS_TOKEN,
          bbox: `${RHODES_BOUNDS.west},${RHODES_BOUNDS.south},${RHODES_BOUNDS.east},${RHODES_BOUNDS.north}`, // Limit to Rhodes
          limit: 1,
          types: 'poi,address,place'
        },
        timeout: 8000
      }
    );

    const feature = response.data?.features?.[0];
    if (feature?.center) {
      const [lng, lat] = feature.center;
      
      if (isValidRhodesCoordinates(lat, lng)) {
        console.log(`✅ Mapbox geocoding successful: ${locationName} -> ${lat}, ${lng}`);
        return { lat, lng };
      } else {
        console.log(`⚠️ Mapbox coordinates outside Rhodes bounds: ${lat}, ${lng}`);
        return null;
      }
    }

    console.log(`❌ No location found in Mapbox for: ${locationName}`);
    return null;
  } catch (error) {
    console.error(`❌ Mapbox geocoding error for ${locationName}:`, error.message);
    return null;
  }
}

/**
 * Main geocoding function with hybrid approach
 * @param {string} locationName - Name of the location to geocode
 * @param {string} fullAddress - Optional full address for better accuracy
 * @returns {Promise<{lat: number, lng: number} | null>}
 */
export async function geocodeLocation(locationName, fullAddress = null) {
  if (!locationName?.trim()) {
    console.log('❌ Empty location name provided');
    return null;
  }

  const searchQuery = fullAddress || locationName;
  
  // Check cache first
  const cached = getCachedCoordinates(searchQuery);
  if (cached) {
    return cached;
  }

  console.log(`🗺️ Starting geocoding for: ${searchQuery}`);

  // Try Google Places first (since we're already paying for it)
  let coordinates = await geocodeWithGoogle(searchQuery);
  
  // Fallback to Mapbox if Google fails
  if (!coordinates) {
    console.log(`🗺️ Google failed, trying Mapbox fallback for: ${searchQuery}`);
    coordinates = await geocodeWithMapbox(searchQuery);
  }

  // Final fallback to Rhodes center if all else fails
  if (!coordinates) {
    console.log(`⚠️ All geocoding failed for: ${searchQuery}, using Rhodes center`);
    coordinates = { lat: 36.4341, lng: 28.2176 };
  }

  // Cache the result
  setCachedCoordinates(searchQuery, coordinates);
  
  return coordinates;
}

/**
 * Batch geocode multiple locations
 * @param {Array<{name: string, address?: string}>} locations
 * @returns {Promise<Array<{name: string, coordinates: {lat: number, lng: number}}>>}
 */
export async function batchGeocode(locations) {
  if (!Array.isArray(locations) || locations.length === 0) {
    return [];
  }

  console.log(`🗺️ Batch geocoding ${locations.length} locations`);

  const results = await Promise.allSettled(
    locations.map(async (location) => {
      const coordinates = await geocodeLocation(location.name, location.address);
      return {
        ...location,
        coordinates
      };
    })
  );

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value);
}

/**
 * Validate and clean up coordinates
 */
export function validateCoordinates(coordinates) {
  if (!coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
    return null;
  }

  if (!isValidRhodesCoordinates(coordinates.lat, coordinates.lng)) {
    console.log(`⚠️ Coordinates outside Rhodes bounds: ${coordinates.lat}, ${coordinates.lng}`);
    return null;
  }

  return {
    lat: Number(coordinates.lat.toFixed(6)),
    lng: Number(coordinates.lng.toFixed(6))
  };
} 