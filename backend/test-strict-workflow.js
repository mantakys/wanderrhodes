/**
 * Test Script for Strict AI Workflow
 * Tests the AI decision → Server query → AI selection workflow
 */

import { executeAIRoundWorkflow } from './strict-workflow-controller.js';
import { config } from 'dotenv';

// Load environment variables
config();

// Debug logging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`🔍 TEST [${timestamp}] ${message}`);
  if (data) {
    console.log(`🔍 TEST [${timestamp}] DATA:`, JSON.stringify(data, null, 2));
  }
};

/**
 * Test Case 1: Initial POI recommendation for beach lover
 */
async function testInitialBeachRecommendation() {
  debugLog('Starting Test Case 1: Initial beach recommendation');
  
  const testParams = {
    currentRound: 1,
    userPreferences: {
      interests: ['beaches', 'food'],
      budget: 'moderate',
      groupSize: 'couple',
      numberOfPOIs: 5
    },
    selectedPOIs: [],
    totalPOIs: 5,
    userLocation: null // Test without location
  };

  try {
    const result = await executeAIRoundWorkflow(testParams);
    
    if (result.success) {
      debugLog('✅ Test Case 1 PASSED', {
        selectedPOI: result.selectedPOI.name,
        aiReasoning: result.selectedPOI.aiReasoning,
        roundType: result.aiDecision.round_type,
        fitScore: result.selectedPOI.fitScore
      });
      return result;
    } else {
      debugLog('❌ Test Case 1 FAILED', result);
      return null;
    }
  } catch (error) {
    debugLog('💥 Test Case 1 ERROR', { error: error.message });
    return null;
  }
}

/**
 * Test Case 2: Sequential POI recommendation after beach selection
 */
async function testSequentialRecommendation(previousResult) {
  if (!previousResult) {
    debugLog('❌ Skipping Test Case 2: No previous result');
    return null;
  }

  debugLog('Starting Test Case 2: Sequential recommendation after beach');
  
  const testParams = {
    currentRound: 2,
    userPreferences: {
      interests: ['beaches', 'food'],
      budget: 'moderate',
      groupSize: 'couple',
      numberOfPOIs: 5
    },
    selectedPOIs: [previousResult.selectedPOI],
    totalPOIs: 5,
    userLocation: null
  };

  try {
    const result = await executeAIRoundWorkflow(testParams);
    
    if (result.success) {
      debugLog('✅ Test Case 2 PASSED', {
        selectedPOI: result.selectedPOI.name,
        aiReasoning: result.selectedPOI.aiReasoning,
        roundType: result.aiDecision.round_type,
        spatialLogic: result.selectedPOI.spatialLogic,
        fitScore: result.selectedPOI.fitScore
      });
      return result;
    } else {
      debugLog('❌ Test Case 2 FAILED', result);
      return null;
    }
  } catch (error) {
    debugLog('💥 Test Case 2 ERROR', { error: error.message });
    return null;
  }
}

/**
 * Test Case 3: History-focused initial recommendation
 */
async function testHistoryRecommendation() {
  debugLog('Starting Test Case 3: History-focused recommendation');
  
  const testParams = {
    currentRound: 1,
    userPreferences: {
      interests: ['history', 'culture'],
      budget: 'luxury',
      groupSize: 'family',
      numberOfPOIs: 4
    },
    selectedPOIs: [],
    totalPOIs: 4,
    userLocation: { lat: 36.4467, lng: 28.2226 } // Rhodes Old Town
  };

  try {
    const result = await executeAIRoundWorkflow(testParams);
    
    if (result.success) {
      debugLog('✅ Test Case 3 PASSED', {
        selectedPOI: result.selectedPOI.name,
        aiReasoning: result.selectedPOI.aiReasoning,
        roundType: result.aiDecision.round_type,
        searchRadius: result.aiDecision.spatial_strategy.search_radius_meters,
        fitScore: result.selectedPOI.fitScore
      });
      return result;
    } else {
      debugLog('❌ Test Case 3 FAILED', result);
      return null;
    }
  } catch (error) {
    debugLog('💥 Test Case 3 ERROR', { error: error.message });
    return null;
  }
}

/**
 * Test Case 4: Error handling with invalid parameters
 */
async function testErrorHandling() {
  debugLog('Starting Test Case 4: Error handling');
  
  const testParams = {
    currentRound: 0, // Invalid round number
    userPreferences: {},
    selectedPOIs: [],
    totalPOIs: 5,
    userLocation: null
  };

  try {
    const result = await executeAIRoundWorkflow(testParams);
    
    if (!result.success) {
      debugLog('✅ Test Case 4 PASSED - Error correctly handled', {
        error: result.error,
        details: result.details
      });
      return true;
    } else {
      debugLog('❌ Test Case 4 FAILED - Should have failed with invalid parameters', result);
      return false;
    }
  } catch (error) {
    debugLog('✅ Test Case 4 PASSED - Exception correctly thrown', { error: error.message });
    return true;
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  debugLog('🚀 Starting Strict AI Workflow Tests');
  
  console.log('\n' + '='.repeat(80));
  console.log('STRICT AI WORKFLOW VALIDATION TESTS');
  console.log('='.repeat(80) + '\n');

  // Check environment setup
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in environment variables');
    console.error('Please set OPENAI_API_KEY in your .env file');
    process.exit(1);
  }

  const results = {
    totalTests: 4,
    passed: 0,
    failed: 0,
    details: []
  };

  // Test Case 1
  console.log('\n📍 Test Case 1: Initial Beach Recommendation');
  console.log('-'.repeat(50));
  const test1Result = await testInitialBeachRecommendation();
  if (test1Result) {
    results.passed++;
    results.details.push({ test: 'Initial Beach', status: 'PASSED', poi: test1Result.selectedPOI.name });
  } else {
    results.failed++;
    results.details.push({ test: 'Initial Beach', status: 'FAILED' });
  }

  // Test Case 2 (depends on Test 1)
  console.log('\n📍 Test Case 2: Sequential Recommendation');
  console.log('-'.repeat(50));
  const test2Result = await testSequentialRecommendation(test1Result);
  if (test2Result) {
    results.passed++;
    results.details.push({ test: 'Sequential', status: 'PASSED', poi: test2Result.selectedPOI.name });
  } else {
    results.failed++;
    results.details.push({ test: 'Sequential', status: 'FAILED' });
  }

  // Test Case 3
  console.log('\n📍 Test Case 3: History-Focused Recommendation');
  console.log('-'.repeat(50));
  const test3Result = await testHistoryRecommendation();
  if (test3Result) {
    results.passed++;
    results.details.push({ test: 'History Focus', status: 'PASSED', poi: test3Result.selectedPOI.name });
  } else {
    results.failed++;
    results.details.push({ test: 'History Focus', status: 'FAILED' });
  }

  // Test Case 4
  console.log('\n📍 Test Case 4: Error Handling');
  console.log('-'.repeat(50));
  const test4Result = await testErrorHandling();
  if (test4Result) {
    results.passed++;
    results.details.push({ test: 'Error Handling', status: 'PASSED' });
  } else {
    results.failed++;
    results.details.push({ test: 'Error Handling', status: 'FAILED' });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${((results.passed / results.totalTests) * 100).toFixed(1)}%`);
  
  console.log('\nDetailed Results:');
  results.details.forEach((detail, index) => {
    const status = detail.status === 'PASSED' ? '✅' : '❌';
    const poi = detail.poi ? ` - Selected: ${detail.poi}` : '';
    console.log(`  ${index + 1}. ${detail.test}: ${status} ${detail.status}${poi}`);
  });

  if (results.passed === results.totalTests) {
    console.log('\n🎉 All tests passed! Strict AI workflow is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the error logs above.');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error('💥 Test runner error:', error);
    process.exit(1);
  });
}

export { runAllTests, testInitialBeachRecommendation, testSequentialRecommendation };