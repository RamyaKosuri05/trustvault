import api from './api';

export const auditService = {
  getLogs: async (params = {}) => {
    const response = await api.get('/api/v1/audit/logs', { params });
    return response.data;
  },

  getDocumentLogs: async (documentId, params = {}) => {
    const response = await api.get(`/api/v1/audit/documents/${documentId}`, { params });
    return response.data;
  },

  getSecurityEvents: async (params = {}) => {
    const response = await api.get('/api/v1/audit/security-events', { params });
    return response.data;
  },

  verifyChain: async () => {
    const response = await api.get('/api/v1/audit/verify');
    return response.data;
  },

  exportCheckpoint: async () => {
    const response = await api.get('/api/v1/audit/export-checkpoint');
    return response.data;
  },
};
