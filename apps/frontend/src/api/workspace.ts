import { apiClient } from './client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  ownerEmail?: string;
  serviceName: string;
  deploymentPlatform: 'GitHub Pages' | 'Vercel' | 'Railway' | 'Render' | 'Other';
  appUrl: string;
  deploymentWebhookToken: string;
  status: 'Active' | 'Paused' | 'Completed';
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
  openTasks?: number;
  openIncidents?: number;
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: 'Feature' | 'Bug' | 'Task' | 'Incident';
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  points: number;
  due: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type ServiceHealth = {
  name: string;
  path: string;
  status: 'healthy' | 'unhealthy';
  service: string;
  timestamp: string;
};

export type MonitoringSummary = {
  status: 'Healthy' | 'Warning' | 'Down';
  totalRequests: number;
  uptimePercent: number | null;
  avgResponseTimeMs: number | null;
  statusCodes: Record<string, number>;
  lastUpdatedAt: string;
};

export type Dashboard = {
  metrics: Array<{ label: string; value: string }>;
  timeline: Array<{ title: string; owner: string; time: string }>;
  deployments: Deployment[];
  incidents: Incident[];
  projectHealth: Array<{
    projectId: string;
    name: string;
    serviceName: string;
    appUrl: string;
    status: ProjectHealthCheck['status'] | 'unknown';
    statusCode: number | null;
    responseTimeMs: number | null;
    checkedAt: string | null;
  }>;
};

export type Deployment = {
  id: string;
  projectId: string;
  provider: 'Manual' | 'Vercel' | 'GitHub Actions' | 'Railway' | 'Render' | 'Other';
  service: string;
  environment: 'staging' | 'production';
  status: 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Rolled Back';
  version: string;
  deploymentUrl: string;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  externalId: string;
  startedAt: string;
  durationMinutes: number;
};

export type Incident = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: Priority;
  status: 'Open' | 'Investigating' | 'Resolved';
  service: string;
  createdAt: string;
  resolvedAt: string | null;
  summary: string;
};

export type ProjectHealthCheck = {
  id: string;
  projectId: string;
  appUrl: string;
  status: 'healthy' | 'warning' | 'down';
  statusCode: number;
  responseTimeMs: number;
  checkedAt: string;
  error: string;
};

export const workspaceApi = {
  dashboard: () => apiClient.get<Dashboard>('/api/dashboard'),
  projects: () => apiClient.get<{ projects: Project[] }>('/api/projects'),
  createProject: (project: Partial<Project>) => apiClient.post<{ project: Project }>('/api/projects', project),
  updateProject: (id: string, patch: Partial<Project>) => apiClient.patch<{ project: Project }>(`/api/projects/${id}`, patch),
  deleteProject: (id: string) => apiClient.delete<{ ok: true }>(`/api/projects/${id}`),
  projectSummary: (id: string) => apiClient.get<{ project: Project; tasks: Task[]; deployments: Deployment[]; incidents: Incident[]; healthChecks: ProjectHealthCheck[] }>(`/api/projects/${id}/summary`),
  tasks: (projectId?: string) => apiClient.get<{ tasks: Task[] }>(projectId ? `/api/tasks?projectId=${projectId}` : '/api/tasks'),
  createTask: (task: Partial<Task>) => apiClient.post<{ task: Task }>('/api/tasks', task),
  updateTask: (id: string, patch: Partial<Task>) => apiClient.patch<{ task: Task }>(`/api/tasks/${id}`, patch),
  deleteTask: (id: string) => apiClient.delete<{ ok: true }>(`/api/tasks/${id}`),
  serviceHealth: () => apiClient.get<{ services: ServiceHealth[] }>('/api/service-health'),
  monitoringSummary: () => apiClient.get<MonitoringSummary>('/api/monitoring/summary'),
  projectHealthChecks: (projectId: string) => apiClient.get<{ healthChecks: ProjectHealthCheck[] }>(`/api/projects/${projectId}/health-checks`),
  deployments: () => apiClient.get<{ deployments: Deployment[] }>('/api/deployments'),
  projectDeployments: (projectId: string) => apiClient.get<{ deployments: Deployment[] }>(`/api/deployments?projectId=${projectId}`),
  createDeployment: (deployment: Partial<Deployment>) => apiClient.post<{ deployment: Deployment }>('/api/deployments', deployment),
  incidents: (projectId?: string) => apiClient.get<{ incidents: Incident[] }>(projectId ? `/api/incidents?projectId=${projectId}` : '/api/incidents'),
  createIncident: (incident: Partial<Incident>) => apiClient.post<{ incident: Incident }>('/api/incidents', incident),
  updateIncident: (id: string, patch: Partial<Incident>) => apiClient.patch<{ incident: Incident }>(`/api/incidents/${id}`, patch),
};
