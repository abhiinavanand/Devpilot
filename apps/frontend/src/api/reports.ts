import { apiClient } from './client';

export const reportsApi = {
  list: () => apiClient.get('/reports'),
  get: (id: string) => apiClient.get('/reports/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/reports', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/reports/' + id, payload),
};
