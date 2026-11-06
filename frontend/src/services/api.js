import axios from 'axios';

// Ensure global axios defaults and instance send cookies with cross-origin requests
axios.defaults.withCredentials = true;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000, // 30s general timeout for standard business calls
  withCredentials: true, // Crucial for HttpOnly session cookie
  headers: {
    'Content-Type': 'application/json',
  },
});

let csrfToken = null;

export const setCsrfToken = (token) => {
  csrfToken = token;
};

export const getCsrfToken = () => csrfToken;

// Interceptor to add X-CSRF-Token on state-changing requests
api.interceptors.request.use((config) => {
  const method = config.method ? config.method.toUpperCase() : '';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

// Interceptor to handle unauthenticated/unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token if unauthorized
      csrfToken = null;
    }
    return Promise.reject(error);
  }
);

export default api;

