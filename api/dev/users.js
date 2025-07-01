import { getAllUsers } from '../../backend/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      console.log('🔧 Backend running in production mode - admin routes disabled');
      return res.status(404).json({ error: 'Not found' });
    }

    console.log('🔧 Backend running in development mode - admin routes enabled');
    const users = getAllUsers();
    return res.status(200).json({ users });

  } catch (error) {
    console.error('🚨 Dev users API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 