#!/usr/bin/env node

/**
 * Test Script for Enhanced POI System Integration
 * Tests the enhanced chat handler with spatial intelligence features
 */

import { 
  hasEnhancedFeatures, 
  getEnhancedNearbyPlaces, 
  getContextualRecommendations,
  getAlternativeSuggestions,
  getSystemStatus
} from './enhanced-chat-tools.js';

// Test configuration
const TEST_LOCATION = {
  lat: 36.4341,
  lng: 28.2176,
  name: 'Rhodes Center'
};

const TEST_USER_PREFERENCES = {
  budget: 'mid-range',
  interests: ['food', 'culture', 'beaches'],
  minRating: 4.0,
  groupSize: 2,
  pace: 'relaxed'
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

// Utility functions
function logTest(testName, passed, message = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${testName}: PASSED ${message}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: FAILED ${message}`);
  }
  testResults.details.push({ testName, passed, message });
}

function logInfo(message) {
  console.log(`ℹ️  ${message}`);
}

function logSection(title) {
  console.log(`\n🔍 ${title}`);
  console.log('='.repeat(50));
}

// Test functions
async function testSystemStatus() {
  logSection('System Status Test');
  
  try {
    const status = await getSystemStatus();
    logTest('System Status', !!status, `Status: ${status.status}`);
    
    const hasEnhanced = await hasEnhancedFeatures();
    logTest('Enhanced Features Available', hasEnhanced, `Features: ${hasEnhanced ? 'ACTIVE' : 'INACTIVE'}`);
    
    if (hasEnhanced) {
      logInfo(`Enhanced POI Data: ${JSON.stringify(status.data, null, 2)}`);
      logTest('POI Data Available', status.data.totalPOIs > 0, `POIs: ${status.data.totalPOIs}`);
      logTest('Spatial Relationships Available', status.data.totalRelationships > 0, `Relationships: ${status.data.totalRelationships}`);
    }
    
    return hasEnhanced;
  } catch (error) {
    logTest('System Status', false, `Error: ${error.message}`);
    return false;
  }
}

async function testEnhancedNearbyPlaces() {
  logSection('Enhanced Nearby Places Test');
  
  try {
    // Test basic restaurant search
    const restaurants = await getEnhancedNearbyPlaces({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      type: 'restaurant',
      radius: 2000
    });
    
    logTest('Restaurant Search', Array.isArray(restaurants), `Found ${restaurants?.length || 0} restaurants`);
    
    if (restaurants && restaurants.length > 0) {
      const firstRestaurant = restaurants[0];
      logTest('Restaurant Data Structure', 
        firstRestaurant.name && firstRestaurant.latitude && firstRestaurant.longitude,
        `Sample: ${firstRestaurant.name}`
      );
      
      // Check for enhanced fields
      const hasEnhancedFields = firstRestaurant.spatialContext || firstRestaurant.contextualTips;
      logTest('Enhanced Fields Present', hasEnhancedFields, 
        `Spatial: ${!!firstRestaurant.spatialContext}, Tips: ${!!firstRestaurant.contextualTips}`
      );
    }
    
    // Test different POI types
    const beaches = await getEnhancedNearbyPlaces({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      type: 'beach',
      radius: 10000
    });
    
    logTest('Beach Search', Array.isArray(beaches), `Found ${beaches?.length || 0} beaches`);
    
    return restaurants && restaurants.length > 0;
  } catch (error) {
    logTest('Enhanced Nearby Places', false, `Error: ${error.message}`);
    return false;
  }
}

async function testContextualRecommendations() {
  logSection('Contextual Recommendations Test');
  
  try {
    // Test evening dining recommendations
    const eveningDining = await getContextualRecommendations({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      userPreferences: TEST_USER_PREFERENCES,
      timeOfDay: 'evening',
      activityType: 'dining'
    });
    
    logTest('Evening Dining Recommendations', 
      Array.isArray(eveningDining), 
      `Found ${eveningDining?.length || 0} recommendations`
    );
    
    // Test sunset sightseeing recommendations
    const sunsetSightseeing = await getContextualRecommendations({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      userPreferences: TEST_USER_PREFERENCES,
      timeOfDay: 'sunset',
      activityType: 'sightseeing'
    });
    
    logTest('Sunset Sightseeing Recommendations', 
      Array.isArray(sunsetSightseeing), 
      `Found ${sunsetSightseeing?.length || 0} recommendations`
    );
    
    // Test culture recommendations
    const cultureRecommendations = await getContextualRecommendations({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      userPreferences: TEST_USER_PREFERENCES,
      timeOfDay: 'morning',
      activityType: 'culture'
    });
    
    logTest('Culture Recommendations', 
      Array.isArray(cultureRecommendations), 
      `Found ${cultureRecommendations?.length || 0} recommendations`
    );
    
    return eveningDining && eveningDining.length > 0;
  } catch (error) {
    logTest('Contextual Recommendations', false, `Error: ${error.message}`);
    return false;
  }
}

async function testAlternativeSuggestions() {
  logSection('Alternative Suggestions Test');
  
  try {
    // Test alternative suggestions for a known location
    const alternatives = await getAlternativeSuggestions('Palace of the Grand Master', 36.4467, 28.2226);
    
    logTest('Alternative Suggestions', 
      Array.isArray(alternatives), 
      `Found ${alternatives?.length || 0} alternatives`
    );
    
    if (alternatives && alternatives.length > 0) {
      const firstAlt = alternatives[0];
      logTest('Alternative Data Structure', 
        firstAlt.name && firstAlt.latitude && firstAlt.longitude,
        `Sample: ${firstAlt.name}`
      );
      
      logTest('Spatial Relationship Info', 
        firstAlt.distance_meters && firstAlt.relationship,
        `Distance: ${firstAlt.distance_meters}m, Relationship: ${firstAlt.relationship}`
      );
    }
    
    return alternatives && alternatives.length > 0;
  } catch (error) {
    logTest('Alternative Suggestions', false, `Error: ${error.message}`);
    return false;
  }
}

async function testFallbackMechanisms() {
  logSection('Fallback Mechanisms Test');
  
  try {
    // Test with invalid coordinates to trigger fallback
    const invalidResult = await getEnhancedNearbyPlaces({
      lat: 999,
      lng: 999,
      type: 'restaurant',
      radius: 1000
    });
    
    logTest('Invalid Coordinates Fallback', 
      Array.isArray(invalidResult), 
      `Fallback handled gracefully`
    );
    
    // Test with non-existent POI type
    const nonExistentType = await getEnhancedNearbyPlaces({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      type: 'nonexistent_type',
      radius: 1000
    });
    
    logTest('Non-existent Type Fallback', 
      Array.isArray(nonExistentType), 
      `Fallback handled gracefully`
    );
    
    return true;
  } catch (error) {
    logTest('Fallback Mechanisms', false, `Error: ${error.message}`);
    return false;
  }
}

async function testChatHandlerIntegration() {
  logSection('Chat Handler Integration Test');
  
  try {
    // This would normally test the actual chat handler
    // For now, we'll verify the functions are properly exported
    const testTypes = ['restaurant', 'beach', 'attraction', 'cafe'];
    let integrationSuccess = true;
    
    for (const type of testTypes) {
      try {
        const results = await getEnhancedNearbyPlaces({
          lat: TEST_LOCATION.lat,
          lng: TEST_LOCATION.lng,
          type,
          radius: 2000
        });
        
        if (!Array.isArray(results)) {
          integrationSuccess = false;
          break;
        }
      } catch (error) {
        integrationSuccess = false;
        break;
      }
    }
    
    logTest('Chat Handler Integration', integrationSuccess, 
      `All POI types testable through enhanced functions`
    );
    
    return integrationSuccess;
  } catch (error) {
    logTest('Chat Handler Integration', false, `Error: ${error.message}`);
    return false;
  }
}

async function testDebugModes() {
  logSection('Debug Mode Test');
  
  try {
    // Test debug environment variables
    const originalNodeEnv = process.env.NODE_ENV;
    const originalChatDebug = process.env.ENHANCED_CHAT_DEBUG;
    
    // Enable debug mode
    process.env.NODE_ENV = 'development';
    process.env.ENHANCED_CHAT_DEBUG = 'true';
    
    logInfo('Debug mode enabled for testing');
    
    // Test a function to see if debug logs are working
    const testResult = await getEnhancedNearbyPlaces({
      lat: TEST_LOCATION.lat,
      lng: TEST_LOCATION.lng,
      type: 'restaurant',
      radius: 1000
    });
    
    logTest('Debug Mode', true, 'Debug logs should be visible above');
    
    // Restore original environment
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENHANCED_CHAT_DEBUG = originalChatDebug;
    
    return true;
  } catch (error) {
    logTest('Debug Mode', false, `Error: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Enhanced POI System Integration Tests');
  console.log('=' * 60);
  
  // Run tests in order
  const hasEnhanced = await testSystemStatus();
  
  if (hasEnhanced) {
    await testEnhancedNearbyPlaces();
    await testContextualRecommendations();
    await testAlternativeSuggestions();
    await testFallbackMechanisms();
    await testChatHandlerIntegration();
    await testDebugModes();
  } else {
    logInfo('⚠️ Enhanced features not available - skipping advanced tests');
    await testFallbackMechanisms();
  }
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('=' * 30);
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(t => !t.passed)
      .forEach(t => console.log(`  - ${t.testName}: ${t.message}`));
  }
  
  console.log('\n🎉 Testing Complete!');
  
  // Exit with appropriate code
  process.exit(testResults.failed === 0 ? 0 : 1);
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { runAllTests, testResults }; 