import axios from 'axios';

// API Base URL - From environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token, user email, and user name headers
api.interceptors.request.use(
  (config) => {
    // Get JWT token from localStorage
    const token = localStorage.getItem('jwtToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Get user email from localStorage and encode for header safety
    const userEmail = localStorage.getItem('userEmail') || 'system@kiosk.com';
    config.headers['X-User-Email'] = encodeURIComponent(userEmail);

    // Get user display name from localStorage and encode for header safety
    const userName = localStorage.getItem('displayName') || 'System';
    config.headers['X-User-Name'] = encodeURIComponent(userName);

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      const { status, data } = error.response;

      // Handle authentication/authorization errors
      if (status === 401 || status === 403) {
        console.error('Authentication error:', data);
        // Clear auth data
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(new Error('Authentication failed. Please log in again.'));
      }

      // Handle 500 errors with "User not found" message (stale token)
      if (status === 500 && data.message && data.message.includes('User not found')) {
        console.error('User not found in database - clearing stale token');
        // Clear auth data
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(new Error('User session expired. Please log in again.'));
      }

      // Server responded with other error status
      console.error('API Error:', data);
      throw new Error(data.message || 'An error occurred');
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error:', error.request);
      throw new Error('Network error. Please check if the backend server is running.');
    } else {
      // Something else happened
      console.error('Error:', error.message);
      throw new Error(error.message);
    }
  }
);

export default api;
