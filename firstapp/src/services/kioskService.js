import api from './api';

/**
 * Generate kiosk number for a specific POS ID
 * @param {string} posid - POS ID
 * @returns {Promise<number>} - Next available kiosk number
 */
export const generateKioskNo = async (posid) => {
  try {
    const response = await api.get('/kiosks/next-number', {
      params: { posid }
    });
    return response.data.nextKioskNo;
  } catch (error) {
    console.error('Error generating kiosk number:', error);
    return 1;
  }
};

/**
 * Create a new kiosk
 * @param {Object} kioskData - Kiosk data
 * @returns {Promise<Object>} - Created kiosk data
 */
export const createKiosk = async (kioskData) => {
  try {
    const requestData = {
      posid: kioskData.posid,
      kioskno: kioskData.kioskno,
      maker: kioskData.maker || '',
      serialno: kioskData.serialno || '',
      state: kioskData.state ? kioskData.state.toUpperCase() : 'INACTIVE',
      regdate: kioskData.regdate || null,
      setdate: kioskData.setdate || null,
      deldate: kioskData.deldate || null
    };

    const response = await api.post('/kiosks', requestData);
    return convertKioskFromAPI(response.data);
  } catch (error) {
    console.error('Error creating kiosk:', error);
    throw error;
  }
};

/**
 * Get all kiosks
 * @param {boolean} includeDeleted - Include deleted kiosks
 * @returns {Promise<Array>} - Array of kiosks
 */
export const getAllKiosks = async (includeDeleted = false) => {
  try {
    const response = await api.get('/kiosks', {
      params: { includeDeleted }
    });

    return response.data.map(kiosk => convertKioskFromAPI(kiosk));
  } catch (error) {
    console.error('Error getting kiosks:', error);
    throw error;
  }
};

/**
 * Get kiosk by ID
 * @param {string} kioskId - Kiosk ID
 * @returns {Promise<Object>} - Kiosk data
 */
export const getKioskById = async (kioskId) => {
  try {
    const response = await api.get(`/kiosks/${kioskId}`);
    return convertKioskFromAPI(response.data);
  } catch (error) {
    console.error('Error getting kiosk:', error);
    throw error;
  }
};

/**
 * Get kiosks by POS ID
 * @param {string} posid - POS ID
 * @returns {Promise<Array>} - Array of kiosks
 */
export const getKiosksByPosId = async (posid) => {
  try {
    const response = await api.get('/kiosks', {
      params: { posid, includeDeleted: false }
    });
    return response.data.map(kiosk => convertKioskFromAPI(kiosk));
  } catch (error) {
    console.error('Error getting kiosks by POS ID:', error);
    throw error;
  }
};

/**
 * Check if a kiosk with the same posid and kioskno already exists
 * @param {string} posid - POS ID
 * @param {number} kioskno - Kiosk number
 * @param {string} excludeKioskId - Kiosk ID to exclude from check (for edit operation)
 * @returns {Promise<boolean>} - True if duplicate exists, false otherwise
 */
export const checkKioskDuplicate = async (posid, kioskno, excludeKioskId = null) => {
  try {
    const kiosks = await getKiosksByPosId(posid);

    const duplicate = kiosks.find(k =>
      k.kioskno === parseInt(kioskno) &&
      k.id !== excludeKioskId &&
      k.deldate === null
    );

    return !!duplicate;
  } catch (error) {
    console.error('Error checking kiosk duplicate:', error);
    return false;
  }
};

/**
 * Get kiosks by state
 * @param {string} state - Kiosk state
 * @returns {Promise<Array>} - Array of kiosks
 */
export const getKiosksByState = async (state) => {
  try {
    const allKiosks = await getAllKiosks(false);
    return allKiosks.filter(kiosk => kiosk.state?.toLowerCase() === state.toLowerCase());
  } catch (error) {
    console.error('Error getting kiosks by state:', error);
    throw error;
  }
};

/**
 * Update kiosk
 * @param {string} kioskId - Kiosk ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated kiosk data
 */
export const updateKiosk = async (kioskId, updateData) => {
  try {
    const requestData = {
      posid: updateData.posid,
      kioskno: updateData.kioskno,
      maker: updateData.maker || '',
      serialno: updateData.serialno || '',
      state: updateData.state ? updateData.state.toUpperCase() : 'INACTIVE',
      regdate: formatDateTimeForAPI(updateData.regdate),
      setdate: formatDateTimeForAPI(updateData.setdate),
      deldate: formatDateTimeForAPI(updateData.deldate)
    };

    const response = await api.put(`/kiosks/${kioskId}`, requestData);
    return convertKioskFromAPI(response.data);
  } catch (error) {
    console.error('Error updating kiosk:', error);
    throw error;
  }
};

/**
 * Update kiosk state
 * @param {string} kioskId - Kiosk ID
 * @param {string} newState - New state
 * @returns {Promise<void>}
 */
export const updateKioskState = async (kioskId, newState) => {
  try {
    await api.patch(`/kiosks/${kioskId}/state`, null, {
      params: { state: newState.toUpperCase() }
    });
  } catch (error) {
    console.error('Error updating kiosk state:', error);
    throw error;
  }
};

/**
 * Soft delete kiosk
 * @param {string} kioskId - Kiosk ID
 * @returns {Promise<void>}
 */
export const softDeleteKiosk = async (kioskId) => {
  try {
    await api.delete(`/kiosks/${kioskId}`);
  } catch (error) {
    console.error('Error soft deleting kiosk:', error);
    throw error;
  }
};

/**
 * Restore soft deleted kiosk
 * @param {string} kioskId - Kiosk ID
 * @returns {Promise<void>}
 */
export const restoreKiosk = async (kioskId) => {
  try {
    await api.post(`/kiosks/${kioskId}/restore`);
  } catch (error) {
    console.error('Error restoring kiosk:', error);
    throw error;
  }
};

/**
 * Permanently delete kiosk
 * @param {string} kioskId - Kiosk ID
 * @returns {Promise<void>}
 */
export const permanentDeleteKiosk = async (kioskId) => {
  try {
    await api.delete(`/kiosks/${kioskId}/permanent`);
  } catch (error) {
    console.error('Error permanently deleting kiosk:', error);
    throw error;
  }
};

/**
 * Get kiosk configuration by kioskid
 * @param {string} kioskid - Kiosk ID (12 digits)
 * @returns {Promise<Object>} - Kiosk configuration data
 */
export const getKioskConfig = async (kioskid) => {
  try {
    const response = await api.get(`/kiosks/by-kioskid/${kioskid}/config`);
    return response.data;
  } catch (error) {
    console.error('Error getting kiosk config:', error);
    throw error;
  }
};

/**
 * Update kiosk configuration
 * @param {string} kioskid - Kiosk ID (12 digits)
 * @param {Object} configData - Configuration data
 * @returns {Promise<Object>} - Updated configuration response
 */
export const updateKioskConfig = async (kioskid, configData) => {
  try {
    const response = await api.patch(`/kiosks/by-kioskid/${kioskid}/config`, configData);
    return response.data;
  } catch (error) {
    console.error('Error updating kiosk config:', error);
    throw error;
  }
};

/**
 * Update kiosk configuration from admin web (sets configModifiedByWeb flag)
 * @param {number} id - Kiosk database ID
 * @param {Object} configData - Configuration data
 * @returns {Promise} - Response data
 */
export const updateKioskConfigFromWeb = async (id, configData) => {
  try {
    const response = await api.put(`/kiosks/${id}/config`, configData);
    return response.data;
  } catch (error) {
    console.error('Error updating kiosk config from web:', error);
    throw error;
  }
};

/**
 * Get videos assigned to a specific kiosk (from kiosk_videos table)
 * @param {number} kioskId - Kiosk database ID
 * @returns {Promise<Array>} - Array of videos assigned to the kiosk with full details
 */
export const getKioskVideos = async (kioskId) => {
  try {
    const response = await api.get(`/kiosks/${kioskId}/videos-with-status`);
    return response.data;
  } catch (error) {
    console.error('Error getting kiosk videos:', error);
    throw error;
  }
};

/**
 * Convert kiosk data from API format to app format
 * @param {Object} apiKiosk - Kiosk data from API
 * @returns {Object} - Converted kiosk data
 */
function convertKioskFromAPI(apiKiosk) {
  return {
    id: apiKiosk.id,
    kioskid: apiKiosk.kioskid,
    posid: apiKiosk.posid,
    kioskno: apiKiosk.kioskno,
    maker: apiKiosk.maker || '',
    serialno: apiKiosk.serialno || '',
    state: apiKiosk.state?.toLowerCase() || 'inactive',
    regdate: apiKiosk.regdate ? { toMillis: () => new Date(apiKiosk.regdate).getTime(), toDate: () => new Date(apiKiosk.regdate) } : null,
    setdate: apiKiosk.setdate ? { toMillis: () => new Date(apiKiosk.setdate).getTime(), toDate: () => new Date(apiKiosk.setdate) } : null,
    deldate: apiKiosk.deldate ? { toMillis: () => new Date(apiKiosk.deldate).getTime(), toDate: () => new Date(apiKiosk.deldate) } : null,
    storeRegdate: apiKiosk.storeRegdate ? { toMillis: () => new Date(apiKiosk.storeRegdate).getTime(), toDate: () => new Date(apiKiosk.storeRegdate) } : null,
    createdAt: apiKiosk.createdAt,
    updatedAt: apiKiosk.updatedAt,
    totalVideoCount: apiKiosk.totalVideoCount || 0,
    downloadedVideoCount: apiKiosk.downloadedVideoCount || 0,
    // Configuration fields
    menuId: apiKiosk.menuId || null,
    videoId: apiKiosk.videoId || null,
    menuFilename: apiKiosk.menuFilename || null,
    videoFilename: apiKiosk.videoFilename || null,
    menuDownloadStatus: apiKiosk.menuDownloadStatus || null,
    // Status fields
    lastSync: apiKiosk.lastSync || null,
    lastHeartbeat: apiKiosk.lastHeartbeat || null,
    connectionStatus: apiKiosk.connectionStatus || null,
    isLoggedIn: apiKiosk.isLoggedIn || false,
    configModifiedByWeb: apiKiosk.configModifiedByWeb || false
  };
}

/**
 * Format date/timestamp for API (convert Timestamp or Date to ISO string)
 * Uses local timezone to avoid date shifting issues
 * @param {*} date - Date to format (can be Timestamp, Date, or string)
 * @returns {string|null} - ISO datetime string (YYYY-MM-DDTHH:mm:ss) or null
 */
function formatDateTimeForAPI(date) {
  if (!date) return null;

  let d;

  // Convert to Date object
  if (date.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    // Check if it's already in ISO format
    if (/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date;
    }
    // Try to parse it
    d = new Date(date);
    if (isNaN(d.getTime())) {
      return null;
    }
  } else {
    return null;
  }

  // Convert to local ISO string (not UTC) to preserve timezone
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

export default {
  createKiosk,
  getAllKiosks,
  getKioskById,
  getKiosksByPosId,
  getKiosksByState,
  updateKiosk,
  updateKioskState,
  softDeleteKiosk,
  restoreKiosk,
  permanentDeleteKiosk,
  generateKioskNo,
  checkKioskDuplicate,
  getKioskConfig,
  updateKioskConfig,
  getKioskVideos
};
