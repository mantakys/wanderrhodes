import stepHandler from '../backend/stepHandler.js';

// Step-by-step POI recommendation endpoint
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await stepHandler(req, res);
  } catch (error) {
    console.error('Error in step handler:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      success: false,
      message: error.message
    });
  }
} 