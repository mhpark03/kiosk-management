import api from './api';

const API_BASE_URL = 'http://localhost:8080/api';

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

      // Store token and user info
      localStorage.setItem('jwtToken', token);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('displayName', name);
      localStorage.setItem('userRole', role);

      return response.data;
    } catch (error) {
      console.error('Signup error:', error);
      throw new Error(error.response?.data?.message || 'Signup failed');
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
