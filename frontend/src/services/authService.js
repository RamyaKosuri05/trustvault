import api, { setCsrfToken } from './api';

export const authService = {
  login: async (email, password) => {
    const response = await api.post('/api/v1/auth/login', { email, password });
    if (response.data && response.data.csrf_token) {
      setCsrfToken(response.data.csrf_token);
    }
    return response.data;
  },

  register: async (full_name, email, password, role = 'viewer') => {
    const response = await api.post('/api/v1/auth/register', {
      full_name,
      email,
      password,
      role,
    });
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } finally {
      setCsrfToken(null);
    }
  },

  getMe: async () => {
    // 12-second initial session handshake timeout to handle cloud cold starts gracefully
    const response = await api.get('/api/v1/auth/me', { timeout: 12000 });
    return response.data;
  },
};

