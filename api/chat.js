import chatHandler from '../backend/chatHandler.js';
import agentHandler from '../backend/agentHandler.js';

// Unified chat endpoint for all chat-related functionality
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body || req.query;
  
  try {
    // Default to regular chat if no action specified
    if (!action || action === 'chat' || action === 'send-prompt') {
      await chatHandler(req, res);
    } else if (action === 'agent') {
      await agentHandler(req, res);
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error in chat handler:', error.message);
    res.status(500).json({ 
      error: 'Internal server error',
      fallback: true,
      reply: "I apologize, but I'm experiencing technical difficulties. Please try your request again.",
      structuredData: { locations: [], metadata: { error: error.message } }
    });
  }
}
