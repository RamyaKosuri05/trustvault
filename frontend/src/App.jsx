import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/layout/Layout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import DocumentDetail from './pages/DocumentDetail';
import UploadDocument from './pages/UploadDocument';
import AuditLogs from './pages/AuditLogs';
import UserManagement from './pages/UserManagement';
import Categories from './pages/Categories';
import NotFound from './pages/NotFound';

// Route Guard wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#08090C] text-slate-400 text-xs font-mono">
        <span className="relative flex h-3 w-3 mb-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
        </span>
        <span className="tracking-wider">ESTABLISHING ZERO-TRUST SESSION CONTEXT...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Layout>{children}</Layout>;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          {/* Default Landing Route must be the modern Login Page */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <Documents scope="owned" pageTitle="My Documents" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/shared"
            element={
              <ProtectedRoute allowedRoles={['viewer', 'owner']}>
                <Documents scope="shared" pageTitle="Shared With Me" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/documents/:id"
            element={
              <ProtectedRoute>
                <DocumentDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/upload"
            element={
              <ProtectedRoute allowedRoles={['owner']}>
                <UploadDocument />
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit"
            element={
              <ProtectedRoute allowedRoles={['admin', 'owner']}>
                <AuditLogs />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            }
          />

          <Route
            path="/categories"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Categories />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
  );
}

export default App;

