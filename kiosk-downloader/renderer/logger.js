/**
 * Logger utility for Kiosk Video Downloader
 * Logs important events to both console and file
 */

const Logger = {
  /**
   * Log an info-level event
   * @param {string} eventType - Event type (e.g., 'APP_START', 'SYNC_COMPLETED')
   * @param {string} message - Log message
   * @param {Object} data - Optional additional data
   */
  info: async function(eventType, message, data = null) {
    console.log(`[INFO] [${eventType}] ${message}`, data || '');
    try {
      await window.electronAPI.writeLog('INFO', eventType, message, data);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  },

  /**
   * Log a warning-level event
   * @param {string} eventType - Event type
   * @param {string} message - Log message
   * @param {Object} data - Optional additional data
   */
  warn: async function(eventType, message, data = null) {
    console.warn(`[WARN] [${eventType}] ${message}`, data || '');
    try {
      await window.electronAPI.writeLog('WARN', eventType, message, data);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  },

  /**
   * Log an error-level event
   * @param {string} eventType - Event type
   * @param {string} message - Log message
   * @param {Object} data - Optional additional data
   */
  error: async function(eventType, message, data = null) {
    console.error(`[ERROR] [${eventType}] ${message}`, data || '');
    try {
      await window.electronAPI.writeLog('ERROR', eventType, message, data);
    } catch (error) {
      console.error('Failed to write log to file:', error);
    }
  }
};

// Event type constants for consistency
Logger.Events = {
  // Application lifecycle
  APP_START: 'APP_START',
  APP_INIT: 'APP_INIT',
  APP_EXIT: 'APP_EXIT',

  // Configuration
  CONFIG_SAVED: 'CONFIG_SAVED',
  CONFIG_DELETED: 'CONFIG_DELETED',
  CONFIG_UPDATED: 'CONFIG_UPDATED',
  CONFIG_READ: 'CONFIG_READ',

  // Video synchronization
  SYNC_STARTED: 'SYNC_STARTED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  SYNC_FAILED: 'SYNC_FAILED',
  AUTO_SYNC_STARTED: 'AUTO_SYNC_STARTED',

  // Video downloads
  DOWNLOAD_STARTED: 'DOWNLOAD_STARTED',
  DOWNLOAD_COMPLETED: 'DOWNLOAD_COMPLETED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  DOWNLOAD_PROGRESS: 'DOWNLOAD_PROGRESS',

  // WebSocket
  WEBSOCKET_CONNECTED: 'WEBSOCKET_CONNECTED',
  WEBSOCKET_DISCONNECTED: 'WEBSOCKET_DISCONNECTED',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  WEBSOCKET_MESSAGE: 'WEBSOCKET_MESSAGE',
  SYNC_COMMAND_RECEIVED: 'SYNC_COMMAND_RECEIVED',

  // User authentication
  USER_LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_LOGOUT: 'USER_LOGOUT',

  // Errors
  ERROR_GENERAL: 'ERROR_GENERAL',
  ERROR_NETWORK: 'ERROR_NETWORK',
  ERROR_FILE_SYSTEM: 'ERROR_FILE_SYSTEM'
};

// Export for use in other modules
window.Logger = Logger;
