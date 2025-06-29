import fetch from 'node-fetch';

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export async function getNearbyPlaces({ lat, lng, radius = 1000, type = 'restaurant' }) {
  // Mapbox does not provide ratings or user reviews like Google, so only basic info is returned
  const query = encodeURIComponent(type);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?proximity=${lng},${lat}&types=poi&access_token=${MAPBOX_ACCESS_TOKEN}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.features) {
    console.error('Mapbox getNearbyPlaces: No features in response', data);
    return [];
  }
  return data.features.map(place => ({
    name: place.text,
    address: place.place_name,
    rating: null,
    place_id: place.id,
    coordinates: { lat: place.center[1], lng: place.center[0] },
    total_ratings: null,
  }));
}

export async function getTravelTime({ origin, destination, mode = 'driving' }) {
  // origin and destination should be strings like 'lat,lng'
  const mapboxMode = mode === 'walking' ? 'walking' : mode === 'cycling' ? 'cycling' : 'driving';
  const url = `https://api.mapbox.com/directions/v5/mapbox/${mapboxMode}/${origin};${destination}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.routes || data.routes.length === 0) return null;
  const route = data.routes[0];
  return {
    distance_m: route.distance,
    duration_s: route.duration,
  };
} 