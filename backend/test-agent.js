#!/usr/bin/env node
// Test script for the agentic framework
import dotenv from 'dotenv';
import agentHandler from './agentHandler.js';

dotenv.config();

// Mock request/response objects for testing
function createMockRequest(prompt, userLocation = null) {
  return {
    method: 'POST',
    body: {
      prompt,
      userLocation,
      history: []
    }
  };
}

function createMockResponse() {
  let statusCode = 200;
  let responseData = null;
  let headers = {};

  const mockRes = {
    status: (code) => {
      statusCode = code;
      return mockRes;
    },
    json: (data) => {
      responseData = data;
      return mockRes;
    },
    setHeader: (key, value) => {
      headers[key] = value;
      return mockRes;
    },
    end: (message) => {
      responseData = message;
      return mockRes;
    },
    getResult: () => ({
      statusCode,
      data: responseData,
      headers
    })
  };

  return mockRes;
}

// Test scenarios
const testScenarios = [
  {
    name: "Simple Restaurant Search",
    prompt: "Find me good restaurants in Faliraki",
    userLocation: { lat: 36.3386, lng: 28.2018 },
    expectedTools: ["getNearbyPlaces", "getTravelTime"]
  },
  {
    name: "Complex Day Trip Planning", 
    prompt: "Plan a full day in Rhodes Old Town starting at 10 AM. I'm interested in history and good food.",
    userLocation: { lat: 36.4447, lng: 28.2240 },
    expectedTools: ["getNearbyPlaces", "getTravelTime"]
  },
  {
    name: "Multi-region Planning",
    prompt: "I have 2 days in Rhodes. Day 1 focus on beaches, Day 2 explore villages and culture.",
    userLocation: { lat: 36.4341, lng: 28.2176 },
    expectedTools: ["getNearbyPlaces", "getTravelTime"]
  }
];

async function runTest(scenario) {
  console.log(`\n🧪 Testing: ${scenario.name}`);
  console.log(`📝 Prompt: "${scenario.prompt}"`);
  console.log(`📍 User Location: ${scenario.userLocation ? `${scenario.userLocation.lat}, ${scenario.userLocation.lng}` : 'None'}`);
  
  const req = createMockRequest(scenario.prompt, scenario.userLocation);
  const res = createMockResponse();
  
  const startTime = Date.now();
  
  try {
    await agentHandler(req, res);
    const result = res.getResult();
    const duration = Date.now() - startTime;
    
    if (result.statusCode === 200 && result.data) {
      console.log(`✅ Test passed (${duration}ms)`);
      
      const { reply, structuredData } = result.data;
      
      // Analyze response
      console.log(`📊 Response Analysis:`);
      console.log(`   - Reply length: ${reply?.length || 0} characters`);
      console.log(`   - Locations found: ${structuredData?.locations?.length || 0}`);
      console.log(`   - Tools used: ${structuredData?.metadata?.toolsUsed?.join(', ') || 'None'}`);
      console.log(`   - Intermediate steps: ${structuredData?.metadata?.intermediateSteps || 0}`);
      console.log(`   - Agent state: ${structuredData?.metadata?.agentState?.planningPhase || 'Unknown'}`);
      
      // Check if expected tools were used
      const toolsUsed = structuredData?.metadata?.toolsUsed || [];
      const expectedTools = scenario.expectedTools;
      const toolsMatched = expectedTools.every(tool => toolsUsed.includes(tool));
      
      if (toolsMatched) {
        console.log(`🛠️ Expected tools used: ✅`);
      } else {
        console.log(`🛠️ Expected tools used: ❌ (Expected: ${expectedTools.join(', ')}, Used: ${toolsUsed.join(', ')})`);
      }
      
      // Show sample location data
      if (structuredData?.locations?.length > 0) {
        const firstLocation = structuredData.locations[0];
        console.log(`📍 Sample location: ${firstLocation.name} (${firstLocation.type})`);
        if (firstLocation.travel) {
          console.log(`   - Travel: ${firstLocation.travel.durationMinutes}min, ${Math.round(firstLocation.travel.distanceMeters/1000*10)/10}km`);
        }
      }
      
    } else {
      console.log(`❌ Test failed: Status ${result.statusCode}`);
      console.log(`   Error: ${result.data?.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.log(`💥 Test crashed: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Agentic Framework Tests');
  console.log('=' .repeat(50));
  
  // Check environment
  if (!process.env.OPENAI_API_KEY) {
    console.log('❌ OPENAI_API_KEY not set in environment');
    process.exit(1);
  }
  
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.log('⚠️ GOOGLE_MAPS_API_KEY not set - tool functionality will be limited');
  }
  
  console.log('✅ Environment check passed');
  
  // Run each test scenario
  for (const scenario of testScenarios) {
    await runTest(scenario);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 All tests completed');
  console.log('=' .repeat(50));
}

// Performance benchmarking
async function runPerformanceBenchmark() {
  console.log('\n⚡ Performance Benchmark');
  console.log('-'.repeat(30));
  
  const simplePrompt = "Find restaurants near me";
  const userLocation = { lat: 36.4341, lng: 28.2176 };
  
  const runs = 3;
  const times = [];
  
  for (let i = 0; i < runs; i++) {
    const req = createMockRequest(simplePrompt, userLocation);
    const res = createMockResponse();
    
    const startTime = Date.now();
    await agentHandler(req, res);
    const duration = Date.now() - startTime;
    
    times.push(duration);
    console.log(`Run ${i + 1}: ${duration}ms`);
  }
  
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  console.log(`📈 Performance Summary:`);
  console.log(`   - Average: ${avgTime.toFixed(0)}ms`);
  console.log(`   - Min: ${minTime}ms`);
  console.log(`   - Max: ${maxTime}ms`);
}

// Main execution
async function main() {
  try {
    await runAllTests();
    await runPerformanceBenchmark();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 