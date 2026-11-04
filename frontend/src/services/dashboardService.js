import api from './api';

export const dashboardService = {
  getOwner: async () => {
    const response = await api.get('/api/v1/dashboard/owner');
    return response.data;
  },

  getViewer: async () => {
    const response = await api.get('/api/v1/dashboard/viewer');
    return response.data;
  },

  getAdmin: async () => {
    const response = await api.get('/api/v1/dashboard/admin');
    return response.data;
  },
};

export const categoryService = {
  list: async () => {
    const response = await api.get('/api/v1/categories');
    return response.data;
  },

  create: async (data) => {
    const response = await api.post('/api/v1/categories', data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/v1/categories/${id}`);
    return response.data;
  },
};
