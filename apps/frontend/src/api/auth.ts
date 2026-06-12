import { apiClient } from './client';

export const authApi = {
  list: () => apiClient.get('/auth'),
  get: (id: string) => apiClient.get('/auth/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/auth', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/auth/' + id, payload),
};
