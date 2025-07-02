import axios from 'axios';
import { fetchPlacePhoto } from '../backend/tools/googlePlaces.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;
  
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  try {
    switch (action) {
      case 'proxy':
        return await handlePhotoProxy(req, res);
      case 'place':
        return await handlePlacePhoto(req, res);
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('🚨 Photos API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePhotoProxy(req, res) {
  const { url } = req.query;
  console.log('🖼️ Proxy fetching image:', url);
  
  if (!url) {
    return res.status(400).send('Missing url parameter');
  }

  try {
    const resp = await axios.get(url, { 
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'WanderRhodes/1.0 (https://wanderrhodes.com)'
      }
    });
    
    res.setHeader('Content-Type', resp.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public,max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(resp.data);
  } catch (e) {
    console.error('Photo proxy error:', e.message);
    res.status(500).send('Failed to fetch image');
  }
}

async function handlePlacePhoto(req, res) {
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
    console.error('Error in place photo handler:', err.message);
    return res.status(500).json({ error: 'Failed to fetch photo' });
  }
} 