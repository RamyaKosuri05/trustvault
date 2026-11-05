import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serverColdStart, setServerColdStart] = useState(false);

  const checkAuth = async () => {
    try {
      const data = await authService.getMe();
      setUser(data);
      setServerColdStart(false);
    } catch (err) {
      setUser(null);
      // Detect cold start (ECONNABORTED timeout, 502/503/504 gateway, or network connection drop)
      const isTimeout = err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isGateway = [502, 503, 504].includes(err.response?.status);
      const isNetwork = !err.response && Boolean(err.request);
      if (isTimeout || isGateway || isNetwork) {
        setServerColdStart(true);
      }
    } finally {
      // Immediately terminate the blocker so user is not stuck on loading screen
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    setUser(data.user);
    setServerColdStart(false);
    return data;
  };

  const register = async (fullName, email, password, role) => {
    return await authService.register(fullName, email, password, role);
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        serverColdStart,
        login,
        register,
        logout,
        checkAuth,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isOwner: user?.role === 'owner',
        isViewer: user?.role === 'viewer',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


