import { apiClient } from './client';

export const projectsApi = {
  list: () => apiClient.get('/projects'),
  get: (id: string) => apiClient.get('/projects/' + id),
  create: (payload: Record<string, unknown>) => apiClient.post('/projects', payload),
  update: (id: string, payload: Record<string, unknown>) => apiClient.put('/projects/' + id, payload),
};
