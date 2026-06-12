import { apiClient } from './client';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  status: 'Active' | 'Paused' | 'Completed';
  createdAt: string;
  updatedAt: string;
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

export type AnalyticsSummary = {
  cards: {
    totalProjects: number;
    activeProjects: number;
    completedTasks: number;
    pendingTasks: number;
    errorRate: number;
    avgResponseTime: number;
  };
  series: Array<{ date: string; projects: number; tasks: number; requests: number; latency: number }>;
};

export type Dashboard = {
  metrics: Array<{ label: string; value: string; trend: string }>;
  deploymentSeries: Array<{ name: string; success: number; failed: number }>;
  latencySeries: Array<{ time: string; p95: number; p99: number }>;
  timeline: Array<{ title: string; owner: string; time: string }>;
  dora: DoraMetrics;
  incidentAnalysis: IncidentAnalysis;
  githubSummary: {
    repositories: number;
    commits: number;
    pullRequests: number;
    latestCommit?: GitHubCommit;
  };
  kubernetesSummary: {
    nodes: number;
    pods: number;
    unhealthyPods: number;
    deployments: number;
  };
};

export type Deployment = {
  id: string;
  service: string;
  environment: 'staging' | 'production';
  status: 'Queued' | 'Running' | 'Succeeded' | 'Failed' | 'Rolled Back';
  version: string;
  startedAt: string;
  durationMinutes: number;
  successRate: number;
};

export type Slo = {
  id: string;
  service: string;
  objective: string;
  target: number;
  current: number;
  errorBudgetRemaining: number;
};

export type GitHubRepository = {
  id: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  stars: number;
  openIssues: number;
  lastSyncedAt: string;
};

export type GitHubCommit = {
  sha: string;
  repositoryId: string;
  message: string;
  author: string;
  committedAt: string;
  url: string;
};

export type GitHubPullRequest = {
  id: string;
  repositoryId: string;
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  mergedAt: string | null;
  url: string;
};

export type KubernetesNode = {
  id: string;
  name: string;
  status: 'Ready' | 'NotReady';
  cpuCores: number;
  memoryGi: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
};

export type KubernetesPod = {
  id: string;
  name: string;
  namespace: string;
  status: 'Running' | 'Pending' | 'CrashLoopBackOff';
  restarts: number;
  cpuMillicores: number;
  memoryMi: number;
  nodeName: string;
};

export type KubernetesDeployment = {
  id: string;
  name: string;
  namespace: string;
  desiredReplicas: number;
  availableReplicas: number;
  image: string;
};

export type DoraMetrics = {
  deploymentFrequency: number;
  leadTimeHours: number;
  changeFailureRate: number;
  mttrMinutes: number;
};

export type IncidentAnalysis = {
  riskScore: number;
  summary: string;
  recommendations: string[];
  signals: Array<{ label: string; value: string; severity: Priority }>;
};

export const workspaceApi = {
  dashboard: () => apiClient.get<Dashboard>('/api/dashboard'),
  projects: () => apiClient.get<{ projects: Project[] }>('/api/projects'),
  createProject: (project: Partial<Project>) => apiClient.post<{ project: Project }>('/api/projects', project),
  updateProject: (id: string, patch: Partial<Project>) => apiClient.patch<{ project: Project }>(`/api/projects/${id}`, patch),
  tasks: (projectId?: string) => apiClient.get<{ tasks: Task[] }>(projectId ? `/api/tasks?projectId=${projectId}` : '/api/tasks'),
  createTask: (task: Partial<Task>) => apiClient.post<{ task: Task }>('/api/tasks', task),
  updateTask: (id: string, patch: Partial<Task>) => apiClient.patch<{ task: Task }>(`/api/tasks/${id}`, patch),
  deleteTask: (id: string) => apiClient.delete<{ ok: true }>(`/api/tasks/${id}`),
  serviceHealth: () => apiClient.get<{ services: ServiceHealth[] }>('/api/service-health'),
  analyticsSummary: () => apiClient.get<AnalyticsSummary>('/api/analytics'),
  deployments: () => apiClient.get<{ deployments: Deployment[] }>('/api/deployments'),
  slos: () => apiClient.get<{ slos: Slo[] }>('/api/slos'),
  github: () => apiClient.get<{ repositories: GitHubRepository[]; commits: GitHubCommit[]; pullRequests: GitHubPullRequest[] }>('/api/github'),
  syncGithub: (owner: string, repo: string) => apiClient.post<{ repositories: GitHubRepository[]; commits: GitHubCommit[]; pullRequests: GitHubPullRequest[] }>('/api/github/sync', { owner, repo }),
  kubernetes: () => apiClient.get<{ nodes: KubernetesNode[]; pods: KubernetesPod[]; deployments: KubernetesDeployment[] }>('/api/kubernetes'),
  dora: () => apiClient.get<DoraMetrics>('/api/dora'),
  incidentAnalysis: () => apiClient.get<IncidentAnalysis>('/api/incidents/analysis'),
};
