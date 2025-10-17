import { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check for existing JWT token on mount
  useEffect(() => {
    const initializeAuth = () => {
      if (authService.isAuthenticated()) {
        const currentUser = authService.getCurrentUser();
        setUser({
          email: currentUser.email,
          name: currentUser.displayName,
          role: currentUser.role
        });
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const signup = async (email, password, displayName, phoneNumber) => {
    try {
      const response = await authService.signup(email, password, displayName, phoneNumber);
      setUser({
        email: response.email,
        name: response.displayName,
        role: response.role
      });
      return {
        email: response.email,
        name: response.displayName,
        role: response.role
      };
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authService.login(email, password);
      setUser({
        email: response.email,
        name: response.displayName,
        role: response.role
      });
      return {
        email: response.email,
        name: response.displayName,
        role: response.role
      };
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    try {
      authService.logout();
      setUser(null);
    } catch (error) {
      throw new Error(error.message);
    }
  };

  const resetPassword = async (email) => {
    // JWT doesn't have built-in password reset
    // You would need to implement this on the backend
    throw new Error('Password reset not implemented yet');
  };

  const updatePassword = async (newPassword) => {
    // JWT doesn't have built-in password update
    // You would need to implement this on the backend
    throw new Error('Password update not implemented yet');
  };

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    resetPassword,
    updatePassword,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
