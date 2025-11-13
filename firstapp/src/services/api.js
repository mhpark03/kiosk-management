import axios from 'axios';
import authService from './authService';

// API Base URL - From environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token refresh state management
let isRefreshing = false;
let failedQueue = []

;

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

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

// Response interceptor for error handling and auto token refresh
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response) {
      const { status, data } = error.response;

      // Handle 401 errors - try to refresh token
      if (status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // If already refreshing, queue this request
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(token => {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
              return api(originalRequest);
            })
            .catch(err => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Try to refresh the access token
          console.log('Access token expired, refreshing...');
          const response = await authService.refreshAccessToken();
          const { token } = response;

          // Update the failed requests with new token
          processQueue(null, token);

          // Retry the original request with new token
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed - redirect to login
          console.error('Token refresh failed:', refreshError);
          processQueue(refreshError, null);

          // Clear all auth data
          localStorage.removeItem('jwtToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('userEmail');
          localStorage.removeItem('displayName');
          localStorage.removeItem('userRole');

          // Redirect to login page
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Handle 403 errors - forbidden (no retry, just redirect)
      if (status === 403) {
        console.error('Authorization error:', data);
        // Clear auth data
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(new Error('Authorization failed. Please log in again.'));
      }

      // Handle 500 errors with "User not found" message (stale token)
      if (status === 500 && data.message && data.message.includes('User not found')) {
        console.error('User not found in database - clearing stale token');
        // Clear auth data
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(new Error('User session expired. Please log in again.'));
      }

      // Handle refresh token errors - "Refresh token was expired" or "Refresh token not found"
      if (status === 500 && data.message &&
          (data.message.includes('Refresh token was expired') ||
           data.message.includes('Refresh token not found'))) {
        console.error('Refresh token expired or not found');
        // Clear auth data
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('displayName');
        localStorage.removeItem('userRole');
        // Redirect to login page
        window.location.href = '/login';
        return Promise.reject(new Error('Session expired. Please log in again.'));
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
