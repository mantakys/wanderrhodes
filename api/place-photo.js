import { fetchPlacePhoto } from '../backend/tools/googlePlaces.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const { photoUrl, placeId } = await fetchPlacePhoto(query);
    if (!photoUrl && !placeId) {
      return res.status(404).json({ error: 'No photo or place found' });
    }
    return res.status(200).json({ photoUrl, placeId });
  } catch (err) {
    console.error('Error in /api/place-photo:', err.message);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
}
