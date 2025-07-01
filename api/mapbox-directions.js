const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { coords } = req.body;
    if (!coords || coords.length < 2 || !MAPBOX_ACCESS_TOKEN) {
      return res.status(400).json({ error: 'Missing coordinates or Mapbox access token' });
    }
    
    const coordinates = coords.map(c => `${c.lng},${c.lat}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?geometries=geojson&access_token=${MAPBOX_ACCESS_TOKEN}`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found' });
    }
    
    // Return the route geometry as an array of {lat, lng}
    const route = data.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lng, lat }));
    return res.status(200).json({ route });

  } catch (error) {
    console.error('❌ Mapbox directions error:', error.message);
    return res.status(500).json({ error: error.message });
  }
} 