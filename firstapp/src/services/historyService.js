import api from './api';

// Get all history (both kiosk and store)
export const getAllHistory = async () => {
  try {
    const response = await api.get('/history');
    return response.data;
  } catch (error) {
    console.error('Error fetching history:', error);
    throw error;
  }
};

// Get history by entity type (KIOSK or STORE)
export const getHistoryByEntityType = async (entityType) => {
  try {
    const response = await api.get(`${/history}/type/${entityType}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history:`, error);
    throw error;
  }
};

// Get history by entity ID
export const getHistoryByEntityId = async (entityId) => {
  try {
    const response = await api.get(`${/history}/entity/${entityId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching history by entity ID:', error);
    throw error;
  }
};

// Get history by POS ID
export const getHistoryByPosId = async (posid) => {
  try {
    const response = await api.get(`${/history}/posid/${posid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching history by POS ID:', error);
    throw error;
  }
};

// Get history by entity type and POS ID
export const getHistoryByEntityTypeAndPosId = async (entityType, posid) => {
  try {
    const response = await api.get(`${/history}/type/${entityType}/posid/${posid}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history by POS ID:`, error);
    throw error;
  }
};

// Get history by user
export const getHistoryByUser = async (userid) => {
  try {
    const response = await api.get(`${/history}/user/${userid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching history by user:', error);
    throw error;
  }
};

// Get history by action type
export const getHistoryByAction = async (action) => {
  try {
    const response = await api.get(`${/history}/action/${action}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching history by action:', error);
    throw error;
  }
};

// Get history by entity type and action
export const getHistoryByEntityTypeAndAction = async (entityType, action) => {
  try {
    const response = await api.get(`${/history}/type/${entityType}/action/${action}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history by action:`, error);
    throw error;
  }
};

// Get history by entity type and entity ID
export const getHistoryByEntityTypeAndEntityId = async (entityType, entityId) => {
  try {
    const response = await api.get(`${/history}/type/${entityType}/entity/${entityId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history by entity ID:`, error);
    throw error;
  }
};

export default {
  getAllHistory,
  getHistoryByEntityType,
  getHistoryByEntityId,
  getHistoryByPosId,
  getHistoryByEntityTypeAndPosId,
  getHistoryByUser,
  getHistoryByAction,
  getHistoryByEntityTypeAndAction,
  getHistoryByEntityTypeAndEntityId
};
