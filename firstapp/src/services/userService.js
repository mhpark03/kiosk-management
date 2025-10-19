import api from './api';

export const updateProfile = async (displayName, memo, phoneNumber) => {
  try {
    const response = await api.put('/auth/profile', {
      displayName,
      memo,
      phoneNumber
    });
    return response.data;
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const response = await api.put('/auth/change-password', {
      currentPassword,
      newPassword
    });
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export const getAllUsers = async () => {
  try {
    const response = await api.get('/auth/users');
    return response.data;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw error;
  }
};

export const suspendUser = async (email) => {
  try {
    const response = await api.put(`/auth/users/${encodeURIComponent(email)}/suspend`);
    return response.data;
  } catch (error) {
    console.error('Error suspending user:', error);
    throw error;
  }
};

export const activateUser = async (email) => {
  try {
    const response = await api.put(`/auth/users/${encodeURIComponent(email)}/activate`);
    return response.data;
  } catch (error) {
    console.error('Error activating user:', error);
    throw error;
  }
};

export const deleteUser = async (email) => {
  try {
    const response = await api.delete(`/auth/users/${encodeURIComponent(email)}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUserRole = async (email, role) => {
  try {
    const response = await api.put(`/auth/users/${encodeURIComponent(email)}/role?role=${role}`);
    return response.data;
  } catch (error) {
    console.error('Error updating user role:', error);
    throw error;
  }
};

export const updateUserProfileByAdmin = async (email, displayName, memo, phoneNumber) => {
  try {
    const response = await api.put(`/auth/users/${encodeURIComponent(email)}/profile`, {
      displayName,
      memo,
      phoneNumber
    });
    return response.data;
  } catch (error) {
    console.error('Error updating user profile by admin:', error);
    throw error;
  }
};

export const deleteMyAccount = async () => {
  try {
    const response = await api.delete('/auth/me');
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
