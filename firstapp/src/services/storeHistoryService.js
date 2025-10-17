import axios from 'axios';

const API_URL = 'http://localhost:8080/api/store-history';

// Get all store history
export const getAllStoreHistory = async () => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(API_URL, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching store history:', error);
    throw error;
  }
};

// Get history for a specific store
export const getStoreHistoryByStoreId = async (storeId) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/store/${storeId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching store history by store ID:', error);
    throw error;
  }
};

// Get history by user
export const getStoreHistoryByUser = async (userid) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/user/${userid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching store history by user:', error);
    throw error;
  }
};

// Get history by action type
export const getStoreHistoryByAction = async (action) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/action/${action}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
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
