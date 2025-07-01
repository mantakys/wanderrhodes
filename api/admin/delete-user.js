import { deleteUserByEmail } from '../../backend/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      console.log('🔧 Backend running in production mode - admin routes disabled');
      return res.status(404).json({ error: 'Not found' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    deleteUserByEmail(email);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('🚨 Admin delete user API error:', error.message);
    return res.status(500).json({ error: error.message });
  }
} 