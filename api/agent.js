// import agentHandler from '../backend/agentHandler.js';

// // Vercel style serverless function entry for LangChain agent
// export default async function handler(req, res) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   try {
//     await agentHandler(req, res);
//   } catch (error) {
//     console.error('Error in agent handler:', error.message);
//     res.status(500).json({ 
//       error: 'Internal server error',
//       fallback: true,
//       reply: "I apologize, but I'm experiencing technical difficulties. Please try your request again.",
//       structuredData: { locations: [], metadata: { error: error.message } }
//     });
//   }
// } 