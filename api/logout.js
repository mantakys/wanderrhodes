const IS_PROD = process.env.NODE_ENV === 'production';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.clearCookie('jwt', {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict'
    });
    
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('🚨 Logout API error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 