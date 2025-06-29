// backend/tools/googlePlaces.js
// Fetches photos for places using Google Places API for accurate, relevant results
// Returns null if no suitable image is found.

import axios from 'axios';

// Simple in-memory cache for the session
const photoCache = new Map();
const placeDetailsCache = new Map();
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

// Cache entry structure: { data: any, timestamp: number }
function getCachedData(cache, key) {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRY) {
    return cached.data;
  }
  return undefined;
}

function setCachedData(cache, key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// Find place using Text Search to get place_id
async function findPlaceId(query) {
  const cacheKey = `place_id:${query}`;
  const cached = getCachedData(placeDetailsCache, cacheKey);
  if (cached !== undefined) {
    console.log(`📍 Cache hit for place search: ${query}`);
    return cached;
  }

  try {
    console.log(`📍 Searching for place: ${query}`);
    
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      {
        textQuery: query,
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
          'X-Goog-FieldMask': 'places.id,places.displayName'
        },
        timeout: 8000
      }
    );

    const place = response.data?.places?.[0];
    if (!place) {
      console.log(`📍 No place found for: ${query}`);
      setCachedData(placeDetailsCache, cacheKey, null);
      return null;
    }

    console.log(`📍 Found place: ${place.displayName?.text} (${place.id})`);
    setCachedData(placeDetailsCache, cacheKey, place.id);
    return place.id;
  } catch (err) {
    console.error('📍 Google Places search error:', err.message);
    return null;
  }
}

// Get place photos using place_id
async function getPlacePhotos(placeId) {
  const cacheKey = `photos:${placeId}`;
  const cached = getCachedData(photoCache, cacheKey);
  if (cached !== undefined) {
    console.log(`📸 Cache hit for place photos: ${placeId}`);
    return cached;
  }

  try {
    console.log(`📸 Fetching photos for place: ${placeId}`);
    
    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask': 'photos'
        },
        timeout: 8000
      }
    );

    const photos = response.data?.photos;
    if (!photos || photos.length === 0) {
      console.log(`📸 No photos found for place: ${placeId}`);
      setCachedData(photoCache, cacheKey, null);
      return null;
    }

    // Return the first photo name (highest quality)
    const photoName = photos[0].name;
    console.log(`📸 Found ${photos.length} photos, using: ${photoName}`);
    setCachedData(photoCache, cacheKey, photoName);
    return photoName;
  } catch (err) {
    console.error('📸 Google Places photos error:', err.message);
    return null;
  }
}

// Main function to get photo URL for a place
export async function fetchPlacePhoto(query) {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.warn('📸 Google Places API key not configured, skipping photo fetch');
    return null;
  }

  try {
    // Step 1: Find the place ID
    const placeId = await findPlaceId(query);
    if (!placeId) {
      return null;
    }

    // Step 2: Get photo references for the place
    const photoName = await getPlacePhotos(placeId);
    if (!photoName) {
      return null;
    }

    // Step 3: Construct the photo URL
    const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=800&maxWidthPx=800&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    
    console.log(`📸 Generated photo URL for ${query}`);
    return photoUrl;
  } catch (err) {
    console.error('📸 Error fetching place photo:', err.message);
    return null;
  }
}

// Legacy function name for backward compatibility
export const fetchWikimediaPhoto = fetchPlacePhoto;
