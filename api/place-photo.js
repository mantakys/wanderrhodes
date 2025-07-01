import { fetchPlacePhoto } from '../backend/tools/wikimedia.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }

  try {
    const photoUrl = await fetchPlacePhoto(query);
    if (!photoUrl) {
      return res.status(404).json({ error: 'No photo found' });
    }
    res.json({ photoUrl });
  } catch (err) {
    console.error('Error in /api/place-photo:', err.message);
    res.status(500).json({ error: 'Failed to fetch photo' });
  }
}
