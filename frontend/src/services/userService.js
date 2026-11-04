import api from './api';

export const userService = {
  list: async (params = {}) => {
    const response = await api.get('/api/v1/users', { params });
    return response.data;
  },

  lookupByEmail: async (email) => {
    const response = await api.get('/api/v1/users/lookup', { params: { email } });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/v1/users/${id}`);
    return response.data;
  },

  updateStatus: async (id, isActive) => {
    const response = await api.patch(`/api/v1/users/${id}/status`, { is_active: isActive });
    return response.data;
  },
};
