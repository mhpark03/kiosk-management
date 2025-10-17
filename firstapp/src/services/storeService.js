import api from './api';

/**
 * Create a new store
 * @param {Object} storeData - Store data
 * @param {string} storeData.posname - Store name
 * @param {string} storeData.zonecode - Postal code
 * @param {string} storeData.baseaddress - Base address
 * @param {string} storeData.detailaddress - Detailed address
 * @param {string} storeData.state - Store state (active, inactive, etc.)
 * @returns {Promise<Object>} - Created store data
 */
export const createStore = async (storeData) => {
  try {
    const requestData = {
      posname: storeData.posname || '',
      postcode: storeData.zonecode || '',
      address: storeData.baseaddress || '',
      addressDetail: storeData.detailaddress || '',
      state: storeData.state || 'ACTIVE',
      startdate: formatDateForAPI(storeData.startdate),
      enddate: formatDateForAPI(storeData.enddate)
    };

    const response = await api.post('/stores', requestData);
    return convertStoreFromAPI(response.data);
  } catch (error) {
    console.error('Error creating store:', error);
    throw error;
  }
};

/**
 * Get all stores
 * @param {boolean} includeInactive - Include inactive stores
 * @returns {Promise<Array>} - Array of stores
 */
export const getAllStores = async (includeInactive = true) => {
  try {
    const response = await api.get('/stores', {
      params: { includeDeleted: includeInactive }
    });

    return response.data.map(store => convertStoreFromAPI(store));
  } catch (error) {
    console.error('Error getting stores:', error);
    throw error;
  }
};

/**
 * Get store by ID
 * @param {string} storeId - Store ID
 * @returns {Promise<Object>} - Store data
 */
export const getStoreById = async (storeId) => {
  try {
    const response = await api.get(`/stores/${storeId}`);
    return convertStoreFromAPI(response.data);
  } catch (error) {
    console.error('Error getting store:', error);
    throw error;
  }
};

/**
 * Get store by POS ID
 * @param {string} posid - POS ID
 * @returns {Promise<Object>} - Store data
 */
export const getStoreByPosId = async (posid) => {
  try {
    const response = await api.get(`/stores/posid/${posid}`);
    return convertStoreFromAPI(response.data);
  } catch (error) {
    console.error('Error getting store by POS ID:', error);
    throw error;
  }
};

/**
 * Get stores by POS ID (returns array for compatibility)
 * @param {string} posid - POS ID
 * @returns {Promise<Array>} - Array of stores
 */
export const getStoresByPosId = async (posid) => {
  try {
    const store = await getStoreByPosId(posid);
    return [store];
  } catch (error) {
    console.error('Error getting stores by POS ID:', error);
    return [];
  }
};

/**
 * Get stores by state
 * @param {string} state - Store state
 * @returns {Promise<Array>} - Array of stores
 */
export const getStoresByState = async (state) => {
  try {
    const allStores = await getAllStores(true);
    return allStores.filter(store => store.state?.toLowerCase() === state.toLowerCase());
  } catch (error) {
    console.error('Error getting stores by state:', error);
    throw error;
  }
};

/**
 * Get stores by user ID (not implemented in REST API yet)
 * @param {string} userid - User ID
 * @returns {Promise<Array>} - Array of stores
 */
export const getStoresByUserId = async (userid) => {
  try {
    // TODO: Implement in REST API if needed
    const allStores = await getAllStores(true);
    return allStores.filter(store => store.userid === userid);
  } catch (error) {
    console.error('Error getting stores by user ID:', error);
    throw error;
  }
};

/**
 * Update store
 * @param {string} storeId - Store ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated store data
 */
export const updateStore = async (storeId, updateData) => {
  try {
    const requestData = {
      posname: updateData.posname || '',
      postcode: updateData.zonecode || updateData.postcode || '',
      address: updateData.baseaddress || updateData.address || '',
      addressDetail: updateData.detailaddress || updateData.addressDetail || '',
      state: updateData.state ? updateData.state.toUpperCase() : 'ACTIVE',
      startdate: formatDateForAPI(updateData.startdate),
      enddate: formatDateForAPI(updateData.enddate)
    };

    const response = await api.put(`/stores/${storeId}`, requestData);
    return convertStoreFromAPI(response.data);
  } catch (error) {
    console.error('Error updating store:', error);
    throw error;
  }
};

/**
 * Update store state
 * @param {string} storeId - Store ID
 * @param {string} newState - New state
 * @returns {Promise<void>}
 */
export const updateStoreState = async (storeId, newState) => {
  try {
    const store = await getStoreById(storeId);

    // If changing to 'active' and startdate is empty, set it to today
    let updatedStore = { ...store, state: newState };
    if (newState.toLowerCase() === 'active' && !store.startdate) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;
      updatedStore.startdate = todayStr;
    }

    await updateStore(storeId, updatedStore);
  } catch (error) {
    console.error('Error updating store state:', error);
    throw error;
  }
};

/**
 * Delete store (permanent)
 * @param {string} storeId - Store ID
 * @returns {Promise<void>}
 */
export const deleteStore = async (storeId) => {
  try {
    await api.delete(`/stores/${storeId}/permanent`);
  } catch (error) {
    console.error('Error deleting store:', error);
    throw error;
  }
};

/**
 * Soft delete store
 * @param {string} storeId - Store ID
 * @returns {Promise<void>}
 */
export const softDeleteStore = async (storeId) => {
  try {
    await api.delete(`/stores/${storeId}`);
  } catch (error) {
    console.error('Error soft deleting store:', error);
    throw error;
  }
};

/**
 * Restore deleted store
 * @param {string} storeId - Store ID
 * @returns {Promise<void>}
 */
export const restoreStore = async (storeId) => {
  try {
    await api.post(`/stores/${storeId}/restore`);
  } catch (error) {
    console.error('Error restoring store:', error);
    throw error;
  }
};

/**
 * Convert store data from API format to app format
 * @param {Object} apiStore - Store data from API
 * @returns {Object} - Converted store data
 */
function convertStoreFromAPI(apiStore) {
  return {
    id: apiStore.id,
    posid: apiStore.posid,
    posname: apiStore.posname,
    zonecode: apiStore.postcode,
    baseaddress: apiStore.address,
    detailaddress: apiStore.addressDetail,
    posaddress: apiStore.address + (apiStore.addressDetail ? ' ' + apiStore.addressDetail : ''),
    state: apiStore.state?.toLowerCase() || 'inactive',
    regdate: apiStore.regdate ? { toMillis: () => new Date(apiStore.regdate).getTime(), toDate: () => new Date(apiStore.regdate) } : null,
    startdate: apiStore.startdate,
    enddate: apiStore.deldate,
    userid: apiStore.userid || '',
    createdAt: apiStore.createdAt,
    updatedAt: apiStore.updatedAt
  };
}

/**
 * Format date for API (convert Timestamp or Date to ISO string)
 * Uses local timezone to avoid date shifting issues
 * @param {*} date - Date to format (can be Timestamp, Date, or string)
 * @returns {string|null} - ISO date string (YYYY-MM-DD) or null
 */
function formatDateForAPI(date) {
  if (!date) return null;

  let d;

  // Convert to Date object
  if (date.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    // Check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
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

  // Convert to local date string (not UTC) to preserve timezone
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default {
  createStore,
  getAllStores,
  getStoreById,
  getStoresByPosId,
  getStoresByState,
  getStoresByUserId,
  updateStore,
  updateStoreState,
  deleteStore,
  softDeleteStore,
  restoreStore
};
