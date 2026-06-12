import { apiClient } from './client';

export const notificationsApi = {
  list: () => apiClient.get('/notifications'),
  get: (id: string) => apiClient.get('/notifications/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/notifications', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/notifications/' + id, payload),
};
