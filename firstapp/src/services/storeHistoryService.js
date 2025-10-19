import api from './api';

// Get all store history
export const getAllStoreHistory = async () => {
  try {
    const response = await api.get(/store-history);
    return response.data;
  } catch (error) {
    console.error('Error fetching store history:', error);
    throw error;
  }
};

// Get history for a specific store
export const getStoreHistoryByStoreId = async (storeId) => {
  try {
    const response = await api.get(`${/store-history}/store/${storeId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching store history by store ID:', error);
    throw error;
  }
};

// Get history by user
export const getStoreHistoryByUser = async (userid) => {
  try {
    const response = await api.get(`${/store-history}/user/${userid}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching store history by user:', error);
    throw error;
  }
};

// Get history by action type
export const getStoreHistoryByAction = async (action) => {
  try {
    const response = await api.get(`${/store-history}/action/${action}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching store history by action:', error);
    throw error;
  }
};

export default {
  getAllStoreHistory,
  getStoreHistoryByStoreId,
  getStoreHistoryByUser,
  getStoreHistoryByAction
};
