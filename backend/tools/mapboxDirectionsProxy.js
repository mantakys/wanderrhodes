import express from 'express';
const router = express.Router();

// POST /api/mapbox-directions
router.post('/mapbox-directions', async (req, res) => {
  // Read the token inside the handler
  const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
  try {
    const { coords, profile: userProfile } = req.body;
    const profilesToTry = [userProfile || 'driving', 'walking'];
    console.log('--- /api/mapbox-directions DEBUG ---');
    console.log('Request body:', JSON.stringify(req.body));
    console.log('coords type:', Array.isArray(coords) ? 'array' : typeof coords);
    console.log('coords length:', coords ? coords.length : 'undefined');
    console.log('coords:', coords);
    console.log('MAPBOX_ACCESS_TOKEN present:', !!MAPBOX_ACCESS_TOKEN);

    // Extra validation and logging
    if (!coords) {
      console.warn('Rejecting: coords is missing');
      return res.status(400).json({ error: 'Missing coords in request body.' });
    }
    if (!Array.isArray(coords)) {
      console.warn('Rejecting: coords is not an array');
      return res.status(400).json({ error: 'Coords is not an array.', coords });
    }
    if (coords.length < 2) {
      console.warn('Rejecting: coords has fewer than 2 points');
      return res.status(400).json({ error: 'Need at least 2 coordinates for routing.', coords });
    }
    if (!MAPBOX_ACCESS_TOKEN) {
      console.warn('Rejecting: MAPBOX_ACCESS_TOKEN is missing');
      return res.status(400).json({ error: 'Missing Mapbox access token.' });
    }
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      if (!c || typeof c.lng !== 'number' || typeof c.lat !== 'number') {
        console.warn(`Rejecting: coords[${i}] is invalid`, c);
        return res.status(400).json({ error: `Invalid coordinate at index ${i}. Each coordinate must be an object with numeric 'lng' and 'lat'.`, coord: c });
      }
    }
    // Build segments via pairwise routing (driving first, then walking)
    for (const profile of profilesToTry) {
      const segments = [];
      let anyOk = false;
      for (let i = 0; i < coords.length - 1; i++) {
        const pairUrl = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords[i].lng},${coords[i].lat};${coords[i+1].lng},${coords[i+1].lat}?geometries=geojson&steps=false&access_token=${MAPBOX_ACCESS_TOKEN}`;
        console.log('Pairwise Mapbox Directions URL:', pairUrl);
        const pairResp = await fetch(pairUrl);
        const pairData = await pairResp.json();
        console.log('Pairwise Mapbox response:', JSON.stringify(pairData));
        if (pairData.routes && pairData.routes.length > 0) {
          anyOk = true;
          const segCoords = pairData.routes[0].geometry.coordinates.map(([lng, lat]) => ({ lng, lat }));
          const durationMinutes = pairData.routes[0].duration / 60;
          segments.push({ coordinates: segCoords, durationMinutes });
        }
      }
      if (anyOk && segments.length > 0) {
        return res.json({ route: segments, profile });
      }
    }
    return res.status(404).json({ error: 'No route found (pairwise failed)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router; 