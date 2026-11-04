import api from './api';

export const documentService = {
  list: async (params = {}) => {
    const response = await api.get('/api/v1/documents', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/api/v1/documents/${id}`);
    return response.data;
  },

  upload: async (formData) => {
    const response = await api.post('/api/v1/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  update: async (id, data) => {
    const response = await api.patch(`/api/v1/documents/${id}`, data);
    return response.data;
  },

  uploadVersion: async (id, formData) => {
    const response = await api.put(`/api/v1/documents/${id}/file`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getVersions: async (id) => {
    const response = await api.get(`/api/v1/documents/${id}/versions`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/api/v1/documents/${id}`);
    return response.data;
  },

  download: async (id, filename) => {
    const response = await api.get(`/api/v1/documents/${id}/download`, {
      responseType: 'blob',
    });
    
    // Create download link for blob
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'document');
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

