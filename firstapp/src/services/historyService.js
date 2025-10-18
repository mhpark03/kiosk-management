import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:8443/api';
const API_URL = `${API_BASE_URL}/history`;

// Get all history (both kiosk and store)
export const getAllHistory = async () => {
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
    console.error('Error fetching history:', error);
    throw error;
  }
};

// Get history by entity type (KIOSK or STORE)
export const getHistoryByEntityType = async (entityType) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/type/${entityType}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history:`, error);
    throw error;
  }
};

// Get history by entity ID
export const getHistoryByEntityId = async (entityId) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/entity/${entityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching history by entity ID:', error);
    throw error;
  }
};

// Get history by POS ID
export const getHistoryByPosId = async (posid) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/posid/${posid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching history by POS ID:', error);
    throw error;
  }
};

// Get history by entity type and POS ID
export const getHistoryByEntityTypeAndPosId = async (entityType, posid) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/type/${entityType}/posid/${posid}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history by POS ID:`, error);
    throw error;
  }
};

// Get history by user
export const getHistoryByUser = async (userid) => {
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
    console.error('Error fetching history by user:', error);
    throw error;
  }
};

// Get history by action type
export const getHistoryByAction = async (action) => {
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
    console.error('Error fetching history by action:', error);
    throw error;
  }
};

// Get history by entity type and action
export const getHistoryByEntityTypeAndAction = async (entityType, action) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/type/${entityType}/action/${action}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${entityType} history by action:`, error);
    throw error;
  }
};

// Get history by entity type and entity ID
export const getHistoryByEntityTypeAndEntityId = async (entityType, entityId) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/type/${entityType}/entity/${entityId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
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
