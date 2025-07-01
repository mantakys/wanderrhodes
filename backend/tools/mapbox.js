import axios from 'axios';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('⚠️ GOOGLE_MAPS_API_KEY is not set in the environment. Google Maps API calls will fail.');
}

export async function getNearbyPlaces({ lat, lng, radius = 1000, type = 'restaurant' }) {
  if (!GOOGLE_MAPS_API_KEY) return [];
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    const data = response.data;
    if (!data.results) {
      console.error('Google Places getNearbyPlaces: No results in response', data);
      return [];
    }
    return data.results.map(place => ({
      name: place.name,
      address: place.vicinity,
      rating: place.rating,
      place_id: place.place_id,
      coordinates: { lat: place.geometry.location.lat, lng: place.geometry.location.lng },
      total_ratings: place.user_ratings_total,
    }));
  } catch (err) {
    console.error('Google Places getNearbyPlaces error:', err.message);
    return [];
  }
}

export async function getTravelTime({ origin, destination, mode = 'driving' }) {
  if (!GOOGLE_MAPS_API_KEY) return null;
  try {
    // origin and destination can be place names or lat,lng
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);
    const data = response.data;
    if (!data.routes || data.routes.length === 0 || !data.routes[0].legs || data.routes[0].legs.length === 0) {
      console.error('Google Directions getTravelTime: No routes/legs in response', data);
      return null;
    }
    const leg = data.routes[0].legs[0];
    return {
      distance_m: leg.distance.value,
      duration_s: leg.duration.value,
    };
  } catch (err) {
    console.error('Google Directions getTravelTime error:', err.message);
    return null;
  }
} 