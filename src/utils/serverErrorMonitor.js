// Server Error Monitoring Utility
// This helps track and analyze server error patterns for security monitoring

const SERVER_ERROR_LOG_KEY = 'wr_server_error_log';
const MAX_LOG_ENTRIES = 50;

export const logServerError = (errorData) => {
  try {
    const currentLog = getServerErrorLog();
    const logEntry = {
      timestamp: Date.now(),
      ...errorData,
      userAgent: navigator.userAgent.substring(0, 100), // Truncated for privacy
      url: window.location.pathname,
      id: generateLogId()
    };
    
    currentLog.unshift(logEntry);
    
    // Keep only last MAX_LOG_ENTRIES
    const trimmedLog = currentLog.slice(0, MAX_LOG_ENTRIES);
    
    localStorage.setItem(SERVER_ERROR_LOG_KEY, JSON.stringify(trimmedLog));
    
    // Check for suspicious patterns
    detectSuspiciousActivity(trimmedLog);
    
    console.log('🔍 Server error logged:', logEntry);
  } catch (error) {
    console.warn('Failed to log server error:', error);
  }
};

export const getServerErrorLog = () => {
  try {
    const log = localStorage.getItem(SERVER_ERROR_LOG_KEY);
    return log ? JSON.parse(log) : [];
  } catch (error) {
    console.warn('Failed to read server error log:', error);
    return [];
  }
};

export const clearServerErrorLog = () => {
  try {
    localStorage.removeItem(SERVER_ERROR_LOG_KEY);
    console.log('🧹 Server error log cleared');
  } catch (error) {
    console.warn('Failed to clear server error log:', error);
  }
};

export const getServerErrorStats = () => {
  const log = getServerErrorLog();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  
  const stats = {
    total: log.length,
    lastHour: log.filter(entry => (now - entry.timestamp) < oneHour).length,
    lastDay: log.filter(entry => (now - entry.timestamp) < oneDay).length,
    newChatsTriggered: log.filter(entry => entry.newChatTriggered).length,
    mostRecentError: log.length > 0 ? new Date(log[0].timestamp).toISOString() : null,
    errorTypes: groupBy(log, 'errorType'),
    statusCodes: groupBy(log, 'status')
  };
  
  return stats;
};

const detectSuspiciousActivity = (log) => {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;
  const recentErrors = log.filter(entry => (now - entry.timestamp) < fifteenMinutes);
  
  // Alert if more than 5 server errors in 15 minutes
  if (recentErrors.length >= 5) {
    console.warn('🚨 SECURITY ALERT: High frequency of server errors detected', {
      count: recentErrors.length,
      timeframe: '15 minutes',
      errors: recentErrors.slice(0, 3) // Show first 3 for analysis
    });
    
    // Could trigger additional security measures here
    // e.g., temporary rate limiting, user notification, etc.
  }
  
  // Check for rapid-fire requests (potential DoS)
  const veryRecentErrors = log.filter(entry => (now - entry.timestamp) < 60000); // 1 minute
  if (veryRecentErrors.length >= 3) {
    console.warn('🚨 SECURITY ALERT: Rapid server errors detected', {
      count: veryRecentErrors.length,
      timeframe: '1 minute'
    });
  }
};

const generateLogId = () => {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
};

const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = item[key] || 'unknown';
    groups[group] = (groups[group] || 0) + 1;
    return groups;
  }, {});
}; 