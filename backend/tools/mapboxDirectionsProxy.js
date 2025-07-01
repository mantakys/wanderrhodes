import express from 'express';
const router = express.Router();

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

// POST /api/mapbox-directions
router.post('/mapbox-directions', async (req, res) => {
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
    res.json({ route });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router; 