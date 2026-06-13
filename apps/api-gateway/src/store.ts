import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';
import * as pgStore from './pgStore';

const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';

export type Project = {
  id: string;
  name: string;
  description: string;
  owner: string;
  serviceName: string;
  appUrl: string;
  deploymentWebhookToken: string;
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

export type StoreState = {
  projects: Project[];
  tasks: Task[];
  deployments: Deployment[];
  slos: Slo[];
  githubRepositories: GitHubRepository[];
  githubCommits: GitHubCommit[];
  githubPullRequests: GitHubPullRequest[];
  kubernetesNodes: KubernetesNode[];
  kubernetesPods: KubernetesPod[];
  kubernetesDeployments: KubernetesDeployment[];
  incidents: Incident[];
  projectHealthChecks: ProjectHealthCheck[];
};

const dataDir = process.env.DEVPILOT_DATA_DIR
  ? path.resolve(process.env.DEVPILOT_DATA_DIR)
  : process.env.VERCEL
    ? path.join('/tmp', 'devpilot-ai')
    : path.resolve(__dirname, '..', '.data');
const dbPath = path.join(dataDir, 'devpilot.sqlite');

const now = () => new Date().toISOString();
const json = (value: unknown) => JSON.stringify(value);
const DEFAULT_PROJECT_NAME = 'DevPilot Platform';
const usePostgres = Boolean(process.env.DATABASE_URL);
const normalizeAppUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

const normalizeStatus = (status: unknown): TaskStatus => {
  const value = String(status || '').trim();
  const aliases: Record<string, TaskStatus> = {
    Backlog: 'TODO',
    Todo: 'TODO',
    TODO: 'TODO',
    'In Progress': 'IN_PROGRESS',
    IN_PROGRESS: 'IN_PROGRESS',
    Review: 'REVIEW',
    REVIEW: 'REVIEW',
    Done: 'DONE',
    DONE: 'DONE',
  };
  return aliases[value] || 'TODO';
};
const parseLabels = (value: string | null | undefined) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

const run = (sql: string, ...params: unknown[]) => db.prepare(sql).run(...params);
const get = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).get(...params) as T | undefined;
const all = <T>(sql: string, ...params: unknown[]) => db.prepare(sql).all(...params) as T[];

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    owner TEXT NOT NULL,
    service_name TEXT NOT NULL DEFAULT '',
    app_url TEXT NOT NULL DEFAULT '',
    deployment_webhook_token TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    assignee TEXT NOT NULL,
    points INTEGER NOT NULL,
    due TEXT NOT NULL,
    labels TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'Manual',
    service TEXT NOT NULL,
    environment TEXT NOT NULL,
    status TEXT NOT NULL,
    version TEXT NOT NULL,
    deployment_url TEXT NOT NULL DEFAULT '',
    commit_sha TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    triggered_by TEXT NOT NULL DEFAULT '',
    external_id TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    success_rate INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS slos (
    id TEXT PRIMARY KEY,
    service TEXT NOT NULL,
    objective TEXT NOT NULL,
    target REAL NOT NULL,
    current REAL NOT NULL,
    error_budget_remaining REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_repositories (
    id TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL UNIQUE,
    default_branch TEXT NOT NULL,
    stars INTEGER NOT NULL,
    open_issues INTEGER NOT NULL,
    last_synced_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_commits (
    sha TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    message TEXT NOT NULL,
    author TEXT NOT NULL,
    committed_at TEXT NOT NULL,
    url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS github_pull_requests (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TEXT NOT NULL,
    merged_at TEXT,
    url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kubernetes_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL,
    cpu_cores INTEGER NOT NULL,
    memory_gi INTEGER NOT NULL,
    cpu_usage_percent INTEGER NOT NULL,
    memory_usage_percent INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kubernetes_pods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    namespace TEXT NOT NULL,
    status TEXT NOT NULL,
    restarts INTEGER NOT NULL,
    cpu_millicores INTEGER NOT NULL,
    memory_mi INTEGER NOT NULL,
    node_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kubernetes_deployments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    namespace TEXT NOT NULL,
    desired_replicas INTEGER NOT NULL,
    available_replicas INTEGER NOT NULL,
    image TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    service TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    summary TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS project_health_checks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    app_url TEXT NOT NULL,
    status TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    checked_at TEXT NOT NULL,
    error TEXT NOT NULL DEFAULT ''
  );
`);

try {
  run(`ALTER TABLE projects ADD COLUMN service_name TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

try {
  run(`ALTER TABLE projects ADD COLUMN app_url TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

try {
  run(`ALTER TABLE projects ADD COLUMN deployment_webhook_token TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

try {
  run(`ALTER TABLE tasks ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

try {
  run(`ALTER TABLE deployments ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

[
  `ALTER TABLE deployments ADD COLUMN provider TEXT NOT NULL DEFAULT 'Manual'`,
  `ALTER TABLE deployments ADD COLUMN deployment_url TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE deployments ADD COLUMN commit_sha TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE deployments ADD COLUMN branch TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE deployments ADD COLUMN triggered_by TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE deployments ADD COLUMN external_id TEXT NOT NULL DEFAULT ''`,
].forEach((statement) => {
  try {
    run(statement);
  } catch {
    // Column already exists in upgraded databases.
  }
});

try {
  run(`ALTER TABLE incidents ADD COLUMN project_id TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

try {
  run(`ALTER TABLE incidents ADD COLUMN description TEXT NOT NULL DEFAULT ''`);
} catch {
  // Column already exists in upgraded databases.
}

function ensureDefaultProject() {
  const existing = get<{ id: string }>('SELECT id FROM projects ORDER BY created_at ASC LIMIT 1');
  if (existing) return existing.id;

  const timestamp = now();
  const id = uuid();
  run(
    `INSERT INTO projects (id, name, description, owner, service_name, app_url, deployment_webhook_token, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    DEFAULT_PROJECT_NAME,
    'Core SaaS workspace for project management and DevOps observability.',
    'Platform Team',
    'api-gateway',
    'http://localhost:3000/health',
    uuid(),
    'Active',
    timestamp,
    timestamp,
  );
  return id;
}

function backfillTasksToDefaultProject() {
  const defaultProjectId = ensureDefaultProject();
  run(`UPDATE tasks SET project_id = ? WHERE project_id IS NULL OR project_id = ''`, defaultProjectId);
  run(`UPDATE deployments SET project_id = ? WHERE project_id IS NULL OR project_id = ''`, defaultProjectId);
  run(`UPDATE incidents SET project_id = ? WHERE project_id IS NULL OR project_id = ''`, defaultProjectId);
  return defaultProjectId;
}

const taskFromRow = (row: any): Task => ({
  id: row.id,
  projectId: row.project_id,
  title: row.title,
  description: row.description,
  type: row.type,
  status: normalizeStatus(row.status),
  priority: row.priority,
  assignee: row.assignee,
  points: row.points,
  due: row.due,
  labels: parseLabels(row.labels),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const deploymentFromRow = (row: any): Deployment => ({
  id: row.id,
  projectId: row.project_id,
  provider: row.provider || 'Manual',
  service: row.service,
  environment: row.environment,
  status: row.status,
  version: row.version,
  deploymentUrl: row.deployment_url || '',
  commitSha: row.commit_sha || '',
  branch: row.branch || '',
  triggeredBy: row.triggered_by || '',
  externalId: row.external_id || '',
  startedAt: row.started_at,
  durationMinutes: row.duration_minutes,
});

const sloFromRow = (row: any): Slo => ({
  id: row.id,
  service: row.service,
  objective: row.objective,
  target: row.target,
  current: row.current,
  errorBudgetRemaining: row.error_budget_remaining,
});

const projectFromRow = (row: any): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  owner: row.owner,
  serviceName: row.service_name || '',
  appUrl: row.app_url || '',
  deploymentWebhookToken: row.deployment_webhook_token || '',
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const projectHealthCheckFromRow = (row: any): ProjectHealthCheck => ({
  id: row.id,
  projectId: row.project_id,
  appUrl: row.app_url,
  status: row.status,
  statusCode: row.status_code,
  responseTimeMs: row.response_time_ms,
  checkedAt: row.checked_at,
  error: row.error || '',
});

const ensureProjectWebhookTokens = () => {
  all<{ id: string }>(`SELECT id FROM projects WHERE deployment_webhook_token IS NULL OR deployment_webhook_token = ''`).forEach((project) => {
    run(`UPDATE projects SET deployment_webhook_token = ? WHERE id = ?`, uuid(), project.id);
  });
};

export const readStore = (): StoreState => ({
  ...(usePostgres ? (() => { throw new Error('Use readStoreAsync when DATABASE_URL is configured'); })() : {}),
  projects: listProjects(),
  tasks: all<any>('SELECT * FROM tasks ORDER BY updated_at DESC').map(taskFromRow),
  deployments: all<any>('SELECT * FROM deployments ORDER BY started_at DESC').map(deploymentFromRow),
  slos: all<any>('SELECT * FROM slos ORDER BY error_budget_remaining ASC').map(sloFromRow),
  githubRepositories: listGitHubRepositories(),
  githubCommits: listGitHubCommits(),
  githubPullRequests: listGitHubPullRequests(),
  kubernetesNodes: listKubernetesNodes(),
  kubernetesPods: listKubernetesPods(),
  kubernetesDeployments: listKubernetesDeployments(),
  incidents: listIncidents(),
  projectHealthChecks: listProjectHealthChecks(),
});

export const readStoreAsync = async (): Promise<StoreState> => usePostgres ? pgStore.readStore() : readStore();

export const resetStore = async () => {
  if (usePostgres) return pgStore.resetStore();
  [
    'projects',
    'tasks',
    'deployments',
    'slos',
    'github_repositories',
    'github_commits',
    'github_pull_requests',
    'kubernetes_nodes',
    'kubernetes_pods',
    'kubernetes_deployments',
    'incidents',
    'project_health_checks',
  ].forEach((table) => run(`DELETE FROM ${table}`));
  // seedDatabase();  // Disabled: Start with empty database
  return readStore();
};

export const createTask = (input: Partial<Task>) => {
  if (usePostgres) return pgStore.createTask(input) as any;
  const timestamp = now();
  const projectId = String(input.projectId || ensureDefaultProject());
  const task: Task = {
    id: uuid(),
    projectId,
    title: String(input.title || 'Untitled task'),
    description: String(input.description || ''),
    type: input.type || 'Task',
    status: normalizeStatus(input.status),
    priority: input.priority || 'Medium',
    assignee: String(input.assignee || 'Unassigned'),
    points: Number(input.points || 1),
    due: String(input.due || new Date(Date.now() + 604800000).toISOString().slice(0, 10)),
    labels: Array.isArray(input.labels) ? input.labels.map(String) : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  run(
    `INSERT INTO tasks (id, project_id, title, description, type, status, priority, assignee, points, due, labels, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    task.id,
    task.projectId,
    task.title,
    task.description,
    task.type,
    task.status,
    task.priority,
    task.assignee,
    task.points,
    task.due,
    json(task.labels),
    task.createdAt,
    task.updatedAt,
  );
  return task;
};

export const updateTask = (id: string, patch: Partial<Task>) => {
  if (usePostgres) return pgStore.updateTask(id, patch) as any;
  const existing = get<any>('SELECT * FROM tasks WHERE id = ?', id);
  if (!existing) return undefined;

  const updated: Task = {
    ...taskFromRow(existing),
    ...patch,
    id,
    projectId: String(patch.projectId || existing.project_id || ensureDefaultProject()),
    status: patch.status ? normalizeStatus(patch.status) : normalizeStatus(existing.status),
    labels: Array.isArray(patch.labels) ? patch.labels.map(String) : parseLabels(existing.labels),
    updatedAt: now(),
  };

  run(
    `UPDATE tasks SET project_id = ?, title = ?, description = ?, type = ?, status = ?, priority = ?, assignee = ?, points = ?, due = ?, labels = ?, updated_at = ? WHERE id = ?`,
    updated.projectId,
    updated.title,
    updated.description,
    updated.type,
    updated.status,
    updated.priority,
    updated.assignee,
    updated.points,
    updated.due,
    json(updated.labels),
    updated.updatedAt,
    id,
  );
  return updated;
};

export const listProjects = (): Project[] =>
  (usePostgres ? (() => { throw new Error('Use listProjectsAsync when DATABASE_URL is configured'); })() : ensureProjectWebhookTokens(), all<any>('SELECT * FROM projects ORDER BY updated_at DESC').map(projectFromRow));

export const listProjectsAsync = async (): Promise<Project[]> => usePostgres ? pgStore.listProjects() : listProjects();

export const findProjectByDeploymentWebhookToken = (token: string): Project | undefined => {
  if (usePostgres) return pgStore.findProjectByDeploymentWebhookToken(token) as any;
  ensureProjectWebhookTokens();
  const project = get<any>('SELECT * FROM projects WHERE deployment_webhook_token = ?', token);
  return project ? projectFromRow(project) : undefined;
};

export const createProject = (input: Partial<Project>) => {
  if (usePostgres) return pgStore.createProject(input) as any;
  const timestamp = now();
  const project: Project = {
    id: uuid(),
    name: String(input.name || 'Untitled project'),
    description: String(input.description || ''),
    owner: String(input.owner || 'Platform Team'),
    serviceName: String(input.serviceName || ''),
    appUrl: normalizeAppUrl(input.appUrl),
    deploymentWebhookToken: String(input.deploymentWebhookToken || uuid()),
    status: input.status || 'Active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  run(
    `INSERT INTO projects (id, name, description, owner, service_name, app_url, deployment_webhook_token, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    project.id,
    project.name,
    project.description,
    project.owner,
    project.serviceName,
    project.appUrl,
    project.deploymentWebhookToken,
    project.status,
    project.createdAt,
    project.updatedAt,
  );
  return project;
};

export const updateProject = (id: string, patch: Partial<Project>) => {
  if (usePostgres) return pgStore.updateProject(id, patch) as any;
  const existing = get<any>('SELECT * FROM projects WHERE id = ?', id);
  if (!existing) return undefined;

  const updated: Project = {
    ...projectFromRow(existing),
    ...patch,
    id,
    updatedAt: now(),
  };
  updated.appUrl = normalizeAppUrl(updated.appUrl);

  run(
    `UPDATE projects SET name = ?, description = ?, owner = ?, service_name = ?, app_url = ?, deployment_webhook_token = ?, status = ?, updated_at = ? WHERE id = ?`,
    updated.name,
    updated.description,
    updated.owner,
    updated.serviceName,
    updated.appUrl,
    updated.deploymentWebhookToken || uuid(),
    updated.status,
    updated.updatedAt,
    id,
  );
  return updated;
};

export const deleteProject = (id: string) => {
  if (usePostgres) return pgStore.deleteProject(id) as any;
  const taskCount = get<{ count: number }>('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?', id)?.count ?? 0;
  if (taskCount > 0) return false;
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
};

export const deleteTask = (id: string) => {
  if (usePostgres) return pgStore.deleteTask(id) as any;
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
};

export const createDeployment = (input: Partial<Deployment>) => {
  if (usePostgres) return pgStore.createDeployment(input) as any;
  const existing = input.externalId
    ? get<any>('SELECT * FROM deployments WHERE project_id = ? AND external_id = ?', String(input.projectId || ''), String(input.externalId))
    : undefined;

  const deployment: Deployment = {
    id: existing?.id || uuid(),
    projectId: String(input.projectId || ensureDefaultProject()),
    provider: input.provider || 'Manual',
    service: String(input.service || 'api-gateway'),
    environment: input.environment || 'staging',
    status: input.status || 'Queued',
    version: String(input.version || 'v0.0.1'),
    deploymentUrl: String(input.deploymentUrl || ''),
    commitSha: String(input.commitSha || ''),
    branch: String(input.branch || ''),
    triggeredBy: String(input.triggeredBy || ''),
    externalId: String(input.externalId || ''),
    startedAt: String(input.startedAt || now()),
    durationMinutes: Number(input.durationMinutes || 0),
  };

  if (existing) {
    run(
      `UPDATE deployments SET provider = ?, service = ?, environment = ?, status = ?, version = ?, deployment_url = ?, commit_sha = ?, branch = ?, triggered_by = ?, external_id = ?, started_at = ?, duration_minutes = ? WHERE id = ?`,
      deployment.provider,
      deployment.service,
      deployment.environment,
      deployment.status,
      deployment.version,
      deployment.deploymentUrl,
      deployment.commitSha,
      deployment.branch,
      deployment.triggeredBy,
      deployment.externalId,
      deployment.startedAt,
      deployment.durationMinutes,
      deployment.id,
    );
    return deployment;
  }

  run(
    `INSERT INTO deployments (id, project_id, provider, service, environment, status, version, deployment_url, commit_sha, branch, triggered_by, external_id, started_at, duration_minutes, success_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    deployment.id,
    deployment.projectId,
    deployment.provider,
    deployment.service,
    deployment.environment,
    deployment.status,
    deployment.version,
    deployment.deploymentUrl,
    deployment.commitSha,
    deployment.branch,
    deployment.triggeredBy,
    deployment.externalId,
    deployment.startedAt,
    deployment.durationMinutes,
    0,
  );
  return deployment;
};

export const createIncident = (input: Partial<Incident>) => {
  if (usePostgres) return pgStore.createIncident(input) as any;
  const incident: Incident = {
    id: String(input.id || `INC-${Date.now()}`),
    projectId: String(input.projectId || ensureDefaultProject()),
    title: String(input.title || 'Untitled incident'),
    description: String(input.description || ''),
    severity: input.severity || 'Medium',
    status: input.status || 'Open',
    service: String(input.service || 'api-gateway'),
    createdAt: String(input.createdAt || now()),
    resolvedAt: input.resolvedAt || null,
    summary: String(input.summary || input.description || ''),
  };

  run(
    `INSERT INTO incidents (id, project_id, title, description, severity, status, service, created_at, resolved_at, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    incident.id,
    incident.projectId,
    incident.title,
    incident.description,
    incident.severity,
    incident.status,
    incident.service,
    incident.createdAt,
    incident.resolvedAt,
    incident.summary,
  );
  return incident;
};

export const updateIncident = (id: string, patch: Partial<Incident>) => {
  if (usePostgres) return pgStore.updateIncident(id, patch) as any;
  const existing = get<any>('SELECT * FROM incidents WHERE id = ?', id);
  if (!existing) return undefined;
  const current = listIncidents().find((incident) => incident.id === id);
  if (!current) return undefined;
  const updated: Incident = {
    ...current,
    ...patch,
    id,
    resolvedAt: patch.status === 'Resolved' && !patch.resolvedAt ? now() : patch.resolvedAt ?? current.resolvedAt,
  };

  run(
    `UPDATE incidents SET project_id = ?, title = ?, description = ?, severity = ?, status = ?, service = ?, resolved_at = ?, summary = ? WHERE id = ?`,
    updated.projectId,
    updated.title,
    updated.description,
    updated.severity,
    updated.status,
    updated.service,
    updated.resolvedAt,
    updated.summary || updated.description,
    id,
  );
  return updated;
};

export const recordProjectHealthCheck = (input: Omit<ProjectHealthCheck, 'id' | 'checkedAt'> & { checkedAt?: string }) => {
  if (usePostgres) return pgStore.recordProjectHealthCheck(input) as any;
  const check: ProjectHealthCheck = {
    id: uuid(),
    checkedAt: input.checkedAt || now(),
    ...input,
  };
  run(
    `INSERT INTO project_health_checks (id, project_id, app_url, status, status_code, response_time_ms, checked_at, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    check.id,
    check.projectId,
    check.appUrl,
    check.status,
    check.statusCode,
    check.responseTimeMs,
    check.checkedAt,
    check.error,
  );
  run(
    `DELETE FROM project_health_checks
     WHERE id NOT IN (
       SELECT id FROM project_health_checks WHERE project_id = ? ORDER BY checked_at DESC LIMIT 100
     ) AND project_id = ?`,
    check.projectId,
    check.projectId,
  );
  return check;
};

export const listProjectHealthChecks = (projectId?: string): ProjectHealthCheck[] =>
  (usePostgres ? (() => { throw new Error('Use listProjectHealthChecksAsync when DATABASE_URL is configured'); })() : projectId
    ? all<any>('SELECT * FROM project_health_checks WHERE project_id = ? ORDER BY checked_at DESC', projectId)
    : all<any>('SELECT * FROM project_health_checks ORDER BY checked_at DESC')
  ).map(projectHealthCheckFromRow);

export const listProjectHealthChecksAsync = async (projectId?: string): Promise<ProjectHealthCheck[]> => usePostgres ? pgStore.listProjectHealthChecks(projectId) : listProjectHealthChecks(projectId);

export const upsertGitHubRepository = (repo: Omit<GitHubRepository, 'id' | 'lastSyncedAt'>) => {
  const existing = get<{ id: string }>('SELECT id FROM github_repositories WHERE full_name = ?', repo.fullName);
  const id = existing?.id ?? uuid();
  run(
    `INSERT OR REPLACE INTO github_repositories VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    repo.owner,
    repo.name,
    repo.fullName,
    repo.defaultBranch,
    repo.stars,
    repo.openIssues,
    now(),
  );
  return id;
};

export const replaceGitHubCommits = (repositoryId: string, commits: GitHubCommit[]) => {
  run('DELETE FROM github_commits WHERE repository_id = ?', repositoryId);
  commits.forEach((commit) => {
    run(`INSERT OR REPLACE INTO github_commits VALUES (?, ?, ?, ?, ?, ?)`, commit.sha, repositoryId, commit.message, commit.author, commit.committedAt, commit.url);
  });
};

export const replaceGitHubPullRequests = (repositoryId: string, prs: GitHubPullRequest[]) => {
  run('DELETE FROM github_pull_requests WHERE repository_id = ?', repositoryId);
  prs.forEach((pr) => {
    run(`INSERT OR REPLACE INTO github_pull_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, pr.id, repositoryId, pr.number, pr.title, pr.state, pr.author, pr.createdAt, pr.mergedAt, pr.url);
  });
};

export const listGitHubRepositories = (): GitHubRepository[] =>
  all<any>('SELECT * FROM github_repositories ORDER BY last_synced_at DESC').map((row) => ({
    id: row.id,
    owner: row.owner,
    name: row.name,
    fullName: row.full_name,
    defaultBranch: row.default_branch,
    stars: row.stars,
    openIssues: row.open_issues,
    lastSyncedAt: row.last_synced_at,
  }));

export const listGitHubCommits = (): GitHubCommit[] =>
  all<any>('SELECT * FROM github_commits ORDER BY committed_at DESC LIMIT 20').map((row) => ({
    sha: row.sha,
    repositoryId: row.repository_id,
    message: row.message,
    author: row.author,
    committedAt: row.committed_at,
    url: row.url,
  }));

export const listGitHubPullRequests = (): GitHubPullRequest[] =>
  all<any>('SELECT * FROM github_pull_requests ORDER BY created_at DESC LIMIT 20').map((row) => ({
    id: row.id,
    repositoryId: row.repository_id,
    number: row.number,
    title: row.title,
    state: row.state,
    author: row.author,
    createdAt: row.created_at,
    mergedAt: row.merged_at,
    url: row.url,
  }));

export const listKubernetesNodes = (): KubernetesNode[] =>
  all<any>('SELECT * FROM kubernetes_nodes ORDER BY name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    cpuCores: row.cpu_cores,
    memoryGi: row.memory_gi,
    cpuUsagePercent: row.cpu_usage_percent,
    memoryUsagePercent: row.memory_usage_percent,
  }));

export const listKubernetesPods = (): KubernetesPod[] =>
  all<any>('SELECT * FROM kubernetes_pods ORDER BY namespace ASC, name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    namespace: row.namespace,
    status: row.status,
    restarts: row.restarts,
    cpuMillicores: row.cpu_millicores,
    memoryMi: row.memory_mi,
    nodeName: row.node_name,
  }));

export const listKubernetesDeployments = (): KubernetesDeployment[] =>
  all<any>('SELECT * FROM kubernetes_deployments ORDER BY namespace ASC, name ASC').map((row) => ({
    id: row.id,
    name: row.name,
    namespace: row.namespace,
    desiredReplicas: row.desired_replicas,
    availableReplicas: row.available_replicas,
    image: row.image,
  }));

export const listIncidents = (): Incident[] => {
  if (usePostgres) throw new Error('Use listIncidentsAsync when DATABASE_URL is configured');
  return all<any>('SELECT * FROM incidents ORDER BY created_at DESC').map((row) => ({
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    description: row.description || row.summary,
    severity: row.severity,
    status: row.status,
    service: row.service,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    summary: row.summary,
  }));
};

export const listIncidentsAsync = async (): Promise<Incident[]> => usePostgres ? pgStore.listIncidents() : listIncidents();

export const calculateDoraMetrics = (): DoraMetrics => {
  const deployments = readStore().deployments;
  const prs = listGitHubPullRequests();
  const incidents = listIncidents();
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const recentDeployments = deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= sevenDaysAgo);
  const failedDeployments = recentDeployments.filter((deployment) => ['Failed', 'Rolled Back'].includes(deployment.status));
  const mergedLeadTimes = prs
    .filter((pr) => pr.mergedAt)
    .map((pr) => (new Date(pr.mergedAt as string).getTime() - new Date(pr.createdAt).getTime()) / 3600000)
    .filter((hours) => Number.isFinite(hours) && hours >= 0);
  const resolvedIncidentTimes = incidents
    .filter((incident) => incident.resolvedAt)
    .map((incident) => (new Date(incident.resolvedAt as string).getTime() - new Date(incident.createdAt).getTime()) / 60000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);

  return {
    deploymentFrequency: Number((recentDeployments.length / 7).toFixed(2)),
    leadTimeHours: Number((mergedLeadTimes.reduce((sum, value) => sum + value, 0) / Math.max(mergedLeadTimes.length, 1)).toFixed(1)),
    changeFailureRate: Number(((failedDeployments.length / Math.max(recentDeployments.length, 1)) * 100).toFixed(1)),
    mttrMinutes: Number((resolvedIncidentTimes.reduce((sum, value) => sum + value, 0) / Math.max(resolvedIncidentTimes.length, 1)).toFixed(0)),
  };
};

export const analyzeIncidents = (): IncidentAnalysis => {
  const store = readStore();
  const openCriticalTasks = store.tasks.filter((task) => task.status !== 'DONE' && ['Critical', 'High'].includes(task.priority)).length;
  const unhealthyPods = store.kubernetesPods.filter((pod) => pod.status !== 'Running' || pod.restarts >= 5);
  const tightBudgets = store.slos.filter((slo) => slo.errorBudgetRemaining < 40);
  const failedDeployments = store.deployments.filter((deployment) => ['Failed', 'Rolled Back'].includes(deployment.status));
  const activeIncidents = store.incidents.filter((incident) => incident.status !== 'Resolved');
  const riskScore = Math.min(100, openCriticalTasks * 12 + unhealthyPods.length * 18 + tightBudgets.length * 15 + failedDeployments.length * 10 + activeIncidents.length * 20);

  const recommendations = [
    unhealthyPods.length ? `Stabilize ${unhealthyPods.map((pod) => pod.name).join(', ')} before promoting more releases.` : 'Keep pod restart budgets green during the next deploy window.',
    tightBudgets.length ? `Protect error budget for ${tightBudgets.map((slo) => slo.service).join(', ')} with a temporary change freeze.` : 'SLO budgets are healthy enough for normal release cadence.',
    failedDeployments.length ? 'Run a rollback readiness review for recent failed or rolled-back deployments.' : 'No failed production deployment requires immediate rollback follow-up.',
  ];

  return {
    riskScore,
    summary: riskScore >= 70 ? 'High operational risk: active incidents overlap with reliability signals.' : riskScore >= 40 ? 'Moderate operational risk: watch the next deploy window closely.' : 'Low operational risk: delivery and reliability signals are stable.',
    recommendations,
    signals: [
      { label: 'High-priority open work', value: String(openCriticalTasks), severity: openCriticalTasks > 1 ? 'High' : 'Medium' },
      { label: 'Unhealthy pods', value: String(unhealthyPods.length), severity: unhealthyPods.length ? 'High' : 'Low' },
      { label: 'Tight SLO budgets', value: String(tightBudgets.length), severity: tightBudgets.length ? 'Critical' : 'Low' },
      { label: 'Active incidents', value: String(activeIncidents.length), severity: activeIncidents.length ? 'High' : 'Low' },
    ],
  };
};

export const databaseInfo = () => ({
  ...(usePostgres ? pgStore.databaseInfo() : {
  engine: 'SQLite',
  path: dbPath,
  tables: [
    'tasks',
    'projects',
    'deployments',
    'slos',
    'github_repositories',
    'github_commits',
    'github_pull_requests',
    'kubernetes_nodes',
    'kubernetes_pods',
    'kubernetes_deployments',
    'incidents',
  ],
  }),
});
