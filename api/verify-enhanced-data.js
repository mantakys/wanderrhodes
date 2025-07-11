/**
 * Vercel API Endpoint for Verifying Enhanced Data Migration
 * Checks if POI data and spatial relationships are available
 * 
 * Usage: GET /api/verify-enhanced-data
 */

import { getSystemStatus } from '../backend/enhanced-chat-tools.js';
import { isPOIDataAvailable, getPOIStatistics } from '../backend/db-adapter.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are allowed' 
    });
  }

  try {
    console.log('🔍 Verifying enhanced data status...');
    
    // Check if POI data is available
    const poiAvailable = await isPOIDataAvailable();
    
    // Get system status
    const systemStatus = await getSystemStatus();
    
    // Get POI statistics if available
    let statistics = null;
    if (poiAvailable && getPOIStatistics) {
      try {
        statistics = await getPOIStatistics();
      } catch (error) {
        console.warn('Could not fetch POI statistics:', error.message);
      }
    }
    
    const response = {
      timestamp: new Date().toISOString(),
      database: {
        poiDataAvailable: poiAvailable,
        postgresqlConnected: !!process.env.POSTGRES_POSTGRES_URL || !!process.env.DATABASE_URL
      },
      system: systemStatus,
      statistics: statistics || {
        message: 'Statistics not available'
      },
      deployment: {
        environment: process.env.NODE_ENV || 'development',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        hasEnhancedFeatures: systemStatus.status === 'enhanced'
      }
    };
    
    // Determine overall status
    const overallStatus = poiAvailable && systemStatus.status === 'enhanced' ? 'ready' : 'pending';
    
    return res.status(200).json({
      status: overallStatus,
      message: overallStatus === 'ready' 
        ? 'Enhanced POI system is ready and operational'
        : 'Enhanced POI system needs migration or configuration',
      ...response
    });

  } catch (error) {
    console.error('❌ Verification failed:', error);
    
    return res.status(500).json({
      status: 'error',
      message: 'Verification failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// API route configuration
export const config = {
  maxDuration: 30,
} 