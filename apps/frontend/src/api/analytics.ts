import { apiClient } from './client';

export const analyticsApi = {
  list: () => apiClient.get('/analytics'),
  get: (id: string) => apiClient.get('/analytics/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/analytics', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/analytics/' + id, payload),
};
