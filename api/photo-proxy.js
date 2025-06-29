import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  console.log('🖼️ Proxy fetching image:', url);
  
  if (!url) {
    return res.status(400).send('Missing url');
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
