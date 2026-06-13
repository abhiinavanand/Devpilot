import { cache } from './cache';
import { readStoreAsync } from './store';

export const searchRecords = async (query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `search:${normalizedQuery}`;
  const cached = cache.get<string[]>(cacheKey);
  if (cached) return cached;

  if (!normalizedQuery) return [];

  const store = await readStoreAsync();
  const dataset = [
    ...store.tasks.map((task) => `${task.title} - ${task.status} - ${task.assignee}`),
    ...store.deployments.map((deployment) => `${deployment.service} ${deployment.version} - ${deployment.status}`),
    ...store.slos.map((slo) => `${slo.service} - ${slo.objective}`),
  ];
  const results = dataset.filter((item) => item.toLowerCase().includes(normalizedQuery));
  cache.set(cacheKey, results);
  return results;
};
