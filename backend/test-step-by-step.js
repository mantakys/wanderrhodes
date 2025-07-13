/**
 * Test script for the step-by-step POI recommendation system
 * Tests both location-based and fallback scenarios
 */

import { 
  getInitialRecommendations, 
  getNextRecommendations, 
  addPOIToPlan, 
  finalizePlan 
} from './stepHandler.js';

// Test configurations
const testConfigs = [
  {
    name: "With User Location",
    userLocation: { lat: 36.4341, lng: 28.2176 },
    userPreferences: { 
      interests: ['beaches', 'history'],
      budget: 'mid-range',
      numberOfPOIs: 5
    }
  },
  {
    name: "Without User Location (Fallback)",
    userLocation: null,
    userPreferences: { 
      interests: ['food', 'nature'],
      budget: 'budget',
      numberOfPOIs: 3
    }
  },
  {
    name: "Minimal Preferences",
    userLocation: { lat: 36.4467, lng: 28.2226 }, // Rhodes Old Town
    userPreferences: {}
  }
];

async function testStepByStepSystem() {
  console.log('🚀 Testing Step-by-Step POI Recommendation System\n');
  
  for (const config of testConfigs) {
    console.log(`\n📍 Testing: ${config.name}`);
    console.log(`   Location: ${config.userLocation ? `${config.userLocation.lat}, ${config.userLocation.lng}` : 'None (fallback)'}`);
    console.log(`   Preferences: ${JSON.stringify(config.userPreferences)}`);
    
    try {
      // Test 1: Get initial recommendations
      console.log('\n  🔍 Step 1: Getting initial recommendations...');
      const initialResult = await getInitialRecommendations({
        userLocation: config.userLocation,
        userPreferences: config.userPreferences
      });
      
      if (initialResult.success) {
        console.log(`  ✅ Success: ${initialResult.recommendations.length} recommendations`);
        console.log(`  📊 Source: ${initialResult.source}`);
        console.log(`  🗺️ Location: ${initialResult.location.lat}, ${initialResult.location.lng}`);
        
        // Display first 3 recommendations
        initialResult.recommendations.slice(0, 3).forEach((poi, index) => {
          console.log(`     ${index + 1}. ${poi.name} (${poi.type})`);
        });
      } else {
        console.log(`  ❌ Failed: ${initialResult.error}`);
        continue;
      }
      
      // Test 2: Select first POI and get next recommendations
      const selectedPOI = initialResult.recommendations[0];
      console.log(`\n  🎯 Step 2: Selecting "${selectedPOI.name}" and getting next recommendations...`);
      
      const nextResult = await getNextRecommendations({
        userLocation: config.userLocation,
        userPreferences: config.userPreferences,
        selectedPOIs: [selectedPOI],
        currentStep: 2
      });
      
      if (nextResult.success) {
        console.log(`  ✅ Success: ${nextResult.recommendations.length} next recommendations`);
        console.log(`  📊 Source: ${nextResult.source}`);
        
        // Display context if available
        if (nextResult.context) {
          console.log(`  🎨 Context: ${nextResult.context.activityType} (${nextResult.context.timeOfDay})`);
        }
        
        // Display first 2 next recommendations
        nextResult.recommendations.slice(0, 2).forEach((poi, index) => {
          console.log(`     ${index + 1}. ${poi.name} (${poi.type})`);
        });
      } else {
        console.log(`  ❌ Failed: ${nextResult.error}`);
        continue;
      }
      
      // Test 3: Add POI to plan
      console.log(`\n  📝 Step 3: Adding POI to plan...`);
      const addResult = await addPOIToPlan({
        selectedPOI: selectedPOI,
        currentPlan: []
      });
      
      if (addResult.success) {
        console.log(`  ✅ Success: ${addResult.message}`);
        console.log(`  📋 Plan size: ${addResult.plan.length}`);
      } else {
        console.log(`  ❌ Failed: ${addResult.error}`);
      }
      
      // Test 4: Finalize plan
      console.log(`\n  🎉 Step 4: Finalizing plan...`);
      const finalizeResult = await finalizePlan({
        selectedPOIs: [selectedPOI, nextResult.recommendations[0]],
        userPreferences: config.userPreferences
      });
      
      if (finalizeResult.success) {
        console.log(`  ✅ Success: ${finalizeResult.message}`);
        console.log(`  📋 Final plan: ${finalizeResult.finalizedPlan.length} POIs`);
      } else {
        console.log(`  ❌ Failed: ${finalizeResult.error}`);
      }
      
    } catch (error) {
      console.log(`  💥 Error: ${error.message}`);
      console.log(`  🔍 Stack: ${error.stack}`);
    }
    
    console.log('\n' + '─'.repeat(60));
  }
}

// Test enhanced features availability
async function testEnhancedFeatures() {
  console.log('\n🔧 Testing Enhanced Features...');
  
  try {
    const { hasEnhancedFeatures } = await import('./enhanced-chat-tools.js');
    const enhanced = await hasEnhancedFeatures();
    
    console.log(`Enhanced POI System: ${enhanced ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
    
    if (enhanced) {
      const { getPOIStatistics } = await import('./db-adapter.js');
      try {
        const stats = await getPOIStatistics();
        console.log(`📊 POI Statistics:`, stats);
      } catch (err) {
        console.log(`📊 Could not get POI statistics: ${err.message}`);
      }
    }
  } catch (error) {
    console.log(`❌ Error testing enhanced features: ${error.message}`);
  }
}

// Run tests
async function runTests() {
  console.log('🧪 Step-by-Step POI System Test Suite');
  console.log('=' .repeat(60));
  
  await testEnhancedFeatures();
  await testStepByStepSystem();
  
  console.log('\n✅ Test suite completed!');
  console.log('\n💡 To run this test:');
  console.log('   cd backend && node test-step-by-step.js');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}

export { runTests }; 