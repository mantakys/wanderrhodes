// chatHandler.js
import OpenAI from 'openai';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { getNearbyPlaces, getTravelTime } from './tools/mapbox.js';
import Ajv from 'ajv';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ajv = new Ajv();

const locationSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    type: { type: "string" },
    description: { type: "string" },
    location: {
      type: "object",
      properties: {
        address: { type: "string" },
        coordinates: {
          type: "object",
          properties: {
            lat: { type: "number" },
            lng: { type: "number" },
          },
          required: ["lat", "lng"],
        },
      },
      required: ["address"],
    },
    details: { type: "object" },
    highlights: { type: "array" },
    tips: { type: "array" },
    nearbyAttractions: { type: "array" },
    bestTimeToVisit: { type: "string" },
    travel: { type: "object" },
  },
  required: ["name", "type", "location"],
};

const validateLocation = ajv.compile(locationSchema);

export default async function chatHandler(req, res) {
  if (req.method && req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { history = [], prompt, userLocation = null } = req.body;

  // 1) Retrieve RAG context (disabled)
  // NOTE: Temporarily disabling the knowledge-base retrieval while we refine the RAG pipeline.
  let context = '';
  /*
  try {
    const { stdout } = await execFileAsync('python3', [
      join(__dirname, 'rag_retrieve.py'),
      prompt,
      '3'
    ]);
    const docs = JSON.parse(stdout);
    context = docs.map(d => d.text).join('\n---\n');
    console.log('🔍 Retrieved docs:', docs);
  } catch (err) {
    console.error('Retrieval error:', err);
  }
  */

  // 2) Build system prompt
  const systemPrompt = `
You are WanderRhodes, a passionate local expert and travel companion for Rhodes Island. Think of yourself as a friendly local friend who knows every hidden gem and secret spot on the island.

Your approach to travel planning should be thoughtful and personalized:

**Understanding the Traveler**
- Start by understanding their travel style: Are they adventure-seekers, culture enthusiasts, relaxation-focused, or a mix?
- Consider their energy levels: Do they prefer a packed schedule or a more relaxed pace?
- Think about their interests: History buffs might want more time at archaeological sites, while beach lovers might prioritize coastal spots
- Consider practical aspects: Are they traveling with children, elderly, or have any mobility considerations?

**Crafting the Experience**
- Think about the flow of the day: Morning activities that energize, afternoon breaks to avoid the heat, evening experiences that capture the island's magic
- Consider the emotional journey: Mix must-see attractions with hidden local gems
- Plan for serendipity: Leave room for spontaneous discoveries and local recommendations
- Think about the practical details: Opening hours, peak times to avoid, best photo spots, local customs to respect

**Personal Touches**
- Share insider tips that only locals would know
- Suggest the best times to visit popular spots to avoid crowds
- Recommend local eateries where the real Rhodes experience happens
- Include small details that make a big difference: where to catch the best sunset, which beach has the clearest water, which café has the best view

**Important: For each location you mention, you MUST provide its information in the following JSON format, with NO line breaks or extra spaces:**
{
  "name": "Full name of the location",
  "type": "Category (restaurant, attraction, beach, etc.)",
  "description": "Brief but engaging description",
  "location": {
    "address": "Full address",
    "coordinates": {
      "lat": latitude as number,
      "lng": longitude as number
    }
  },
  "details": {
    "openingHours": "Operating hours if available",
    "priceRange": "Budget level (€, €€, €€€)",
    "rating": "Average rating if available",
    "website": "Official website URL if available",
    "phone": "Contact number if available"
  },
  "highlights": ["Key feature 1", "Key feature 2", "Key feature 3"],
  "tips": ["Local tip 1", "Local tip 2"],
  "bestTimeToVisit": "Recommended time of day or season",
  "nearbyAttractions": ["Nearby point 1", "Nearby point 2"],
  "travel": {
    "distanceMeters": "Number of meters from the PREVIOUS location (omit for the first location)",
    "durationMinutes": "Estimated travel time in minutes from the PREVIOUS location"
  }
}

IMPORTANT RULES FOR JSON:
1. Each location's JSON must be on a single line
2. Do not include any line breaks or extra spaces in the JSON
3. Use double quotes for all strings
4. Use numbers (not strings) for coordinates
5. Provide the JSON immediately after mentioning each location
6. Do not include any text between JSON objects

Example format:
Here's a great spot to visit: {"name": "Example Place", "type": "Restaurant", ...} Another amazing location is: {"name": "Another Place", "type": "Beach", ..., "travel": {"distanceMeters": 12000, "durationMinutes": 18}}

TRAVEL GUIDELINES:
• Before introducing a new location (except the first), CALL the getTravelTime tool with the previous and next location addresses to fetch accurate travel distance/time.
• Insert the returned distance_m and duration_s (convert seconds to minutes, round) into the "travel" object in that next location's JSON.
• Always prefer driving mode unless user specifies walking/cycling.
• If the tool fails, approximate but note "estimated".
• Never omit the travel object except for the first location.
• Order the itinerary to minimize backtracking: each next stop should generally be geographically closer to the following one along the driving route.
• If the user specifies a sub-region (e.g. "south part of Rhodes"), include ONLY locations whose coordinates lie in that region (south of Lindos ≈ latitude < 36.1). Skip anything outside.
• The very first hop should start from the user's stated origin. If the origin is known (e.g. "start at Faliraki"), calculate travel time from that origin to the first location.
• Provide at least 3–6 stops unless the user asks otherwise.

${userLocation ? `User current coordinates: (${userLocation.lat}, ${userLocation.lng}). Treat this as their starting point unless they specify another origin.` : ""}

Context:
${context}

Begin by gathering any missing details from the user, then plan a personalized itinerary using the available tools.
`;

  // 3) Define tools for the assistant
  const tools = [
    {
      type: "function",
      function: {
        name: "getNearbyPlaces",
        description: "Find nearby restaurants by coordinates",
      parameters: {
          type: "object",
        properties: {
            lat: { type: "number" },
            lng: { type: "number" },
            radius: { type: "integer", default: 500 },
            type: { type: "string", default: "restaurant" }
        },
          required: ["lat", "lng"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "getTravelTime",
        description: "Get travel time between two locations",
      parameters: {
          type: "object",
        properties: {
            origin: { type: "string" },
            destination: { type: "string" },
            mode: { type: "string", default: "driving" }
        },
          required: ["origin", "destination"]
        }
      }
    }
  ];

  // Helper to ensure every message has a valid string content (OpenAI API rejects null/undefined)
  const sanitizeMessages = (msgs) => msgs.map((m) => {
    if (m.content === null || m.content === undefined) {
      return { ...m, content: "" };
    }
    // If, for some reason, the content is not a string, coerce it into one
    if (typeof m.content !== "string") {
      return { ...m, content: JSON.stringify(m.content) };
    }
    return m;
  });

  // 4) Main agent loop
  let messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: prompt }
  ];

  const MAX_ITERATIONS = 5;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: sanitizeMessages(messages),
        tools: tools,
        tool_choice: "auto",
    });

    const responseMessage = completion.choices[0].message;
    messages.push(responseMessage);

    if (responseMessage.tool_calls) {
      console.log('🛠️ Tool calls requested:', responseMessage.tool_calls);
      const toolCalls = responseMessage.tool_calls;
      
      const toolResults = await Promise.all(
        toolCalls.map(async (toolCall) => {
          const { name, arguments: args } = toolCall.function;
          const parsedArgs = JSON.parse(args);
          console.log(`🔧 Executing tool: ${name} with args:`, parsedArgs);
          
          let result;
          if (name === "getNearbyPlaces") result = await getNearbyPlaces(parsedArgs);
          else if (name === "getTravelTime") result = await getTravelTime(parsedArgs);
          
          console.log(`✅ Tool ${name} result:`, result);
          
          return {
            tool_call_id: toolCall.id,
            role: 'tool',
            name: name,
            content: JSON.stringify(result)
          };
        })
      );
      messages.push(...toolResults);
      continue;
    }

    const responseText = responseMessage.content || "";
    const { locations } = extractStructuredData(responseText);

    // Break only if the assistant has provided location data AND is not asking further questions.
    if (locations.length > 0 && !responseText.includes('?')) {
      break;
    }

    // If the assistant is still asking the user something (contains '?'), politely instruct it to proceed.
    console.log("Assistant seems to be waiting for user input. Re-prompting to continue…");
    messages.push({
      role: 'user',
      content: 'Please proceed and provide the complete itinerary with all remaining points of interest now, including travel times. You have all the information you need.'
    });
  }

  const finalMessage = messages.filter(m => m.role === 'assistant').pop();
  if (!finalMessage) {
    return res.status(500).json({ error: "Failed to get a response from the assistant." });
  }

  let response = finalMessage.content || "";
  if (response.trim() === "") {
    try {
      const retryCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [...messages, { role: 'user', content: 'Please provide the itinerary now.' }],
      });
      response = retryCompletion.choices[0].message.content || "";
    } catch {}
  }

  console.log("Raw AI Response before parsing:\n---\n", response, "\n---");
  const { locations, cleanedText, metadata } = extractStructuredData(response);
  
  // Augment with travel times/distances if they are missing
  await addTravelTimes(locations, userLocation);

  return res.status(200).json({ 
    reply: cleanedText,
    structuredData: { locations, metadata }
  });
}

// Compute travel time & distance between consecutive locations when missing
async function addTravelTimes(locations, userLocation) {
  // Helper to build coordinate/address string
  const locToString = (loc) =>
    loc?.coordinates ? `${loc.coordinates.lat},${loc.coordinates.lng}` : loc?.address;

  // Compute first leg from userLocation if available
  if (userLocation && locations.length > 0) {
    const first = locations[0];
    if (!first.travel || !(first.travel.distanceMeters && first.travel.durationMinutes)) {
      try {
        const origin = `${userLocation.lat},${userLocation.lng}`;
        const destination = locToString(first.location);
        if (destination) {
          const result = await getTravelTime({ origin, destination });
          if (result) {
            first.travel = {
              distanceMeters: result.distance_m,
              durationMinutes: Math.round(result.duration_s / 60)
            };
          }
        }
      } catch (e) {
        console.error('Failed to fetch first leg travel time:', e.message);
      }
    }
  }

  // Compute travel between consecutive stops
  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];

    if (curr.travel && curr.travel.distanceMeters && curr.travel.durationMinutes) continue;

    try {
      const origin = locToString(prev.location);
      const destination = locToString(curr.location);
      if (!origin || !destination) continue;

      const result = await getTravelTime({ origin, destination });
      if (result) {
        curr.travel = {
          distanceMeters: result.distance_m,
          durationMinutes: Math.round(result.duration_s / 60)
        };
      }
    } catch (e) {
      console.error('Failed to fetch travel time:', e.message);
    }
  }
}

// Helper function to extract structured data from the response
function extractStructuredData(response) {
  try {
    const jsonMatches = [];
    let braceCount = 0;
    let currentMatchStartIndex = -1;
    let inString = false;
    let isEscaped = false;

    for (let i = 0; i < response.length; i++) {
      const char = response[i];

      // Handle escaped characters
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      
      // Toggle inString state if a non-escaped quote is found
      if (char === '"') {
        inString = !inString;
      }

      // Only count braces if not inside a string
      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) {
            currentMatchStartIndex = i;
          }
          braceCount++;
        } else if (char === '}') {
          if (braceCount > 0) {
            braceCount--;
            if (braceCount === 0 && currentMatchStartIndex !== -1) {
              jsonMatches.push(response.substring(currentMatchStartIndex, i + 1));
              currentMatchStartIndex = -1;
            }
          }
        }
      }
    }

    const locations = [];
    const errors = [];
    const validJsonMatches = [];

    jsonMatches.forEach((match, index) => {
      try {
        const data = JSON.parse(match);
        
        if (isValidLocationData(data)) {
          locations.push(data);
          validJsonMatches.push(match);
        } else {
          errors.push({
            type: 'invalid_structure',
            index,
            data: match,
          });
        }
      } catch (e) {
        errors.push({
          type: 'parse_error',
          index,
          error: e.message,
          data: match,
        });
      }
    });

    let cleanedText = response;
    validJsonMatches.forEach(match => {
      cleanedText = cleanedText.replace(match, '|||LOCATION|||');
    });

    if (errors.length > 0) {
      console.log('JSON Extraction Errors:', {
        totalErrors: errors.length,
        errors: errors.map(e => ({
          type: e.type,
          index: e.index,
          message: e.error || 'Invalid structure',
          preview: e.data?.substring(0, 150) + '...'
        }))
      });
    }

    return {
      locations,
      cleanedText,
      metadata: {
        totalLocations: locations.length,
        totalErrors: errors.length,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error in extractStructuredData:', error);
    return {
      locations: [],
      cleanedText: '',
      metadata: {
        totalLocations: 0,
        totalErrors: 1,
        timestamp: new Date().toISOString(),
        error: 'Failed to extract structured data'
      }
    };
  }
}

// Helper function to validate location data structure
function isValidLocationData(data) {
  return validateLocation(data);
}
