import api from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create separate axios instance for auth endpoints (no interceptor)
import axios from 'axios';
const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authService = {
  // Login
  async login(email, password) {
    try {
      const response = await authApi.post('/auth/login', { email, password });
      const { token, email: userEmail, displayName, role } = response.data;

      // Store token and user info
      localStorage.setItem('jwtToken', token);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('displayName', displayName);
      localStorage.setItem('userRole', role);

      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  },

  // Signup
  async signup(email, password, displayName, phoneNumber) {
    try {
      const response = await authApi.post('/auth/signup', { email, password, displayName, phoneNumber });
      const { token, email: userEmail, displayName: name, role } = response.data;

      // Only store token and user info if token is provided (ACTIVE users)
      // PENDING_APPROVAL users won't have a token
      if (token) {
        localStorage.setItem('jwtToken', token);
        localStorage.setItem('userEmail', userEmail);
        localStorage.setItem('displayName', name);
        localStorage.setItem('userRole', role);
      }

      return response.data;
    } catch (error) {
      console.error('=== Detailed Signup Error ===');
      console.error('Error object:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('===========================');

      // Network error (CORS, SSL, connection refused, etc.)
      if (!error.response) {
        if (error.code === 'ERR_NETWORK') {
          throw new Error(`네트워크 에러: 백엔드 서버(${API_BASE_URL})에 연결할 수 없습니다. 서버 상태를 확인하세요.`);
        }
        throw new Error('서버에 연결할 수 없습니다. 네트워크 연결과 서버 상태를 확인하세요.');
      }

      // Server responded with error
      throw new Error(error.response?.data?.message || `서버 에러 (${error.response?.status})`);
    }
  },

  // Logout
  logout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('displayName');
    localStorage.removeItem('userRole');
  },

  // Get current user info from localStorage
  getCurrentUser() {
    const token = localStorage.getItem('jwtToken');
    if (!token) return null;

    return {
      email: localStorage.getItem('userEmail'),
      displayName: localStorage.getItem('displayName'),
      role: localStorage.getItem('userRole'),
    };
  },

  // Check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem('jwtToken');
  },
};

export default authService;
