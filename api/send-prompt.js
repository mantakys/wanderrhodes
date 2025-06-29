import chatHandler from '../backend/chatHandler.js';

// Vercel style serverless function entry for prompt handling
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await chatHandler(req, res);
  } catch (error) {
    console.error('Error in send-prompt handler:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
