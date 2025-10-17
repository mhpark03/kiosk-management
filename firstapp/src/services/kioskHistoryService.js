import api from './api';

/**
 * Get kiosk history by kiosk ID
 * @param {string} kioskid - Kiosk ID
 * @returns {Promise<Array>} - Array of history records
 */
export const getHistoryByKioskId = async (kioskid) => {
  try {
    const response = await api.get(`/kiosks/${kioskid}/history`);
    return response.data.map(record => convertHistoryFromAPI(record));
  } catch (error) {
    console.error('Error getting kiosk history:', error);
    throw error;
  }
};

/**
 * Log kiosk creation
 * Note: This is handled automatically by the backend when creating a kiosk
 * This function is kept for compatibility but does nothing
 */
export const logKioskCreation = async (kioskid, posid, userid, state) => {
  // Backend automatically logs history when creating a kiosk
  console.log('Kiosk creation logged by backend');
};

/**
 * Log kiosk update
 * Note: This is handled automatically by the backend when updating a kiosk
 * This function is kept for compatibility but does nothing
 */
export const logKioskUpdate = async (kioskid, posid, userid, changes) => {
  // Backend automatically logs history when updating a kiosk
  console.log('Kiosk update logged by backend');
};

/**
 * Log kiosk state change
 * Note: This is handled automatically by the backend when changing kiosk state
 * This function is kept for compatibility but does nothing
 */
export const logKioskStateChange = async (kioskid, posid, userid, oldState, newState) => {
  // Backend automatically logs history when changing kiosk state
  console.log('Kiosk state change logged by backend');
};

/**
 * Log kiosk deletion
 * Note: This is handled automatically by the backend when deleting a kiosk
 * This function is kept for compatibility but does nothing
 */
export const logKioskDeletion = async (kioskid, posid, userid) => {
  // Backend automatically logs history when deleting a kiosk
  console.log('Kiosk deletion logged by backend');
};

/**
 * Log kiosk restoration
 * Note: This is handled automatically by the backend when restoring a kiosk
 * This function is kept for compatibility but does nothing
 */
export const logKioskRestoration = async (kioskid, posid, userid) => {
  // Backend automatically logs history when restoring a kiosk
  console.log('Kiosk restoration logged by backend');
};

/**
 * Convert history record from API format to app format
 * @param {Object} apiHistory - History record from API
 * @returns {Object} - Converted history record
 */
function convertHistoryFromAPI(apiHistory) {
  return {
    id: apiHistory.id,
    kioskid: apiHistory.kioskid,
    posid: apiHistory.posid,
    userid: apiHistory.userid,
    action: apiHistory.action,
    detail: apiHistory.detail,
    updatetime: apiHistory.updatetime ? {
      toMillis: () => new Date(apiHistory.updatetime).getTime(),
      toDate: () => new Date(apiHistory.updatetime)
    } : null
  };
}

export default {
  getHistoryByKioskId,
  logKioskCreation,
  logKioskUpdate,
  logKioskStateChange,
  logKioskDeletion,
  logKioskRestoration
};
