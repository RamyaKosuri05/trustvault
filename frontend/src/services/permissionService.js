import api from './api';

export const permissionService = {
  list: async (documentId) => {
    const response = await api.get(`/api/v1/documents/${documentId}/permissions`);
    return response.data;
  },

  grant: async (documentId, data) => {
    const response = await api.post(`/api/v1/documents/${documentId}/permissions`, data);
    return response.data;
  },

  update: async (documentId, permissionId, data) => {
    const response = await api.patch(
      `/api/v1/documents/${documentId}/permissions/${permissionId}`,
      data
    );
    return response.data;
  },

  revoke: async (documentId, permissionId) => {
    const response = await api.delete(
      `/api/v1/documents/${documentId}/permissions/${permissionId}`
    );
    return response.data;
  },
};
