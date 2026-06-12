import { apiClient } from './client';

export const billingApi = {
  list: () => apiClient.get('/billing'),
  get: (id: string) => apiClient.get('/billing/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/billing', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/billing/' + id, payload),
};
