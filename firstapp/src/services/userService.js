import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:8443/api';
const API_URL = `${API_BASE_URL}/auth`;

export const updateProfile = async (displayName, memo, phoneNumber) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/profile`, {
      displayName,
      memo,
      phoneNumber
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/change-password`, {
      currentPassword,
      newPassword
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.get(`${API_URL}/users`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

export const suspendUser = async (email) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/users/${encodeURIComponent(email)}/suspend`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

export const activateUser = async (email) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/users/${encodeURIComponent(email)}/activate`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
};

export const deleteUser = async (email) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.delete(`${API_URL}/users/${encodeURIComponent(email)}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUserRole = async (email, role) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/users/${encodeURIComponent(email)}/role?role=${role}`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const updateUserProfileByAdmin = async (email, displayName, memo, phoneNumber) => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.put(`${API_URL}/users/${encodeURIComponent(email)}/profile`, {
      displayName,
      memo,
      phoneNumber
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user profile by admin:', error);
    throw error;
  }
};

export const deleteMyAccount = async () => {
  try {
    const token = localStorage.getItem('jwtToken');
    const response = await axios.delete(`${API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      withCredentials: true
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

export default {
  updateProfile,
  getCurrentUser,
  changePassword,
  getAllUsers,
  suspendUser,
  activateUser,
  deleteUser,
  updateUserRole,
  updateUserProfileByAdmin,
  deleteMyAccount
};
