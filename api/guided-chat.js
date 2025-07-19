/**
 * Guided Chat API Endpoint
 * Handles the three-phase travel planning: Preferences → POI Rounds → Open Chat
 */

import guidedChatHandler from '../backend/guidedChatHandler.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Route to guided chat handler
  return await guidedChatHandler(req, res);
}