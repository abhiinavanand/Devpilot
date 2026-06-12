import fs from 'fs';
import path from 'path';
import { v4 as uuid } from 'uuid';

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
};

const dataDir = path.resolve(__dirname, '..', '.data');
const dbPath = path.join(dataDir, 'devpilot.sqlite');

const now = () => new Date().toISOString();
const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const json = (value: unknown) => JSON.stringify(value);
const DEFAULT_PROJECT_NAME = 'DevPilot Platform';

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
    service TEXT NOT NULL,
    environment TEXT NOT NULL,
    status TEXT NOT NULL,
    version TEXT NOT NULL,
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
`);

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
    `INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    DEFAULT_PROJECT_NAME,
    'Core SaaS workspace for project management and DevOps observability.',
    'Platform Team',
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

function rowCount(table: string) {
  return get<{ count: number }>(`SELECT COUNT(*) as count FROM ${table}`)?.count ?? 0;
}

function createSeedProject(name: string, description: string, owner: string, status: Project['status'] = 'Active') {
  const timestamp = now();
  const id = uuid();
  run(`INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?)`, id, name, description, owner, status, timestamp, timestamp);
  return id;
}

function createSeedTask(
  projectId: string,
  title: string,
  description: string,
  type: Task['type'],
  status: TaskStatus,
  priority: Priority,
  assignee: string,
  points: number,
  labels: string[],
) {
  const timestamp = now();
  run(
    `INSERT INTO tasks (id, project_id, title, description, type, status, priority, assignee, points, due, labels, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    projectId,
    title,
    description,
    type,
    status,
    priority,
    assignee,
    points,
    new Date(Date.now() + points * 86400000).toISOString().slice(0, 10),
    json(labels),
    timestamp,
    timestamp,
  );
}

function createSeedDeployment(
  projectId: string,
  service: string,
  environment: Deployment['environment'],
  status: Deployment['status'],
  version: string,
  durationMinutes: number,
  successRate: number,
  daysBack: number,
) {
  run(
    `INSERT INTO deployments (id, project_id, service, environment, status, version, started_at, duration_minutes, success_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uuid(),
    projectId,
    service,
    environment,
    status,
    version,
    daysAgo(daysBack),
    durationMinutes,
    successRate,
  );
}

export const seedDatabase = () => {
  if (rowCount('projects') === 0) {
    createSeedProject(DEFAULT_PROJECT_NAME, 'Core SaaS workspace for project management and DevOps observability.', 'Platform Team');
    createSeedProject('Mobile Experience', 'Customer-facing mobile release train and quality work.', 'Experience Team');
    createSeedProject('Payments Reliability', 'Checkout, billing, and finance operations reliability.', 'Revenue Engineering');
    createSeedProject('Analytics Modernization', 'Event pipeline, dashboards, and decision intelligence.', 'Data Platform');
    createSeedProject('Security Hardening', 'Identity, permissions, and compliance readiness.', 'Security Team');
  }

  const projectIds = all<{ id: string }>('SELECT id FROM projects ORDER BY created_at ASC').map((project) => project.id);
  const defaultProjectId = projectIds[0] || ensureDefaultProject();

  if (rowCount('tasks') === 0) {
    const titles = [
      ['Auth latency spike', 'Trace p95 auth latency and deploy cache fix.', 'Incident', 'TODO', 'Critical', 'SRE', 5, ['auth', 'latency']],
      ['Preview environment automation', 'Provision ephemeral review apps from pull requests.', 'Feature', 'IN_PROGRESS', 'High', 'Platform', 8, ['ci-cd']],
      ['Edge caching rollout', 'Move static assets behind CDN cache policy.', 'Task', 'IN_PROGRESS', 'Medium', 'Infra', 3, ['performance']],
      ['Release readiness review', 'Validate rollout checklist and owner signoffs.', 'Task', 'REVIEW', 'Medium', 'Ava Chen', 2, ['release']],
      ['Command palette UX', 'Ship keyboard-first navigation for operators.', 'Feature', 'DONE', 'Low', 'Design', 2, ['frontend']],
      ['AI assistant prompt guardrails', 'Add scoped incident recommendations and safer fallback copy.', 'Task', 'DONE', 'Medium', 'AI', 5, ['ai']],
    ] as const;

    titles.forEach((task, index) =>
  createSeedTask(
    projectIds[index % projectIds.length] || defaultProjectId,
    task[0],
    task[1],
    task[2],
    task[3],
    task[4],
    task[5],
    task[6],
    [...task[7]]

  )
);
    const assignees = ['Ava Chen', 'Noah Patel', 'Mia Torres', 'Ishan Rao', 'Sofia Kim', 'Liam Brooks'];
    const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
    const priorities: Priority[] = ['Low', 'Medium', 'High', 'Critical'];
    for (let index = 0; index < 44; index += 1) {
      createSeedTask(
        projectIds[index % projectIds.length] || defaultProjectId,
        `Demo work item ${index + 1}`,
        `Seeded delivery task ${index + 1} for internship demo data.`,
        index % 7 === 0 ? 'Bug' : 'Task',
        statuses[index % statuses.length],
        priorities[index % priorities.length],
        assignees[index % assignees.length],
        (index % 8) + 1,
        ['demo', index % 2 === 0 ? 'frontend' : 'backend'],
      );
    }
  }

  backfillTasksToDefaultProject();

  if (rowCount('deployments') === 0) {
    createSeedDeployment(projectIds[0] || defaultProjectId, 'api-gateway', 'production', 'Succeeded', 'v1.8.4', 14, 99, 1);
    createSeedDeployment(projectIds[1] || defaultProjectId, 'auth-service', 'production', 'Running', 'v1.5.2', 7, 97, 0.2);
    createSeedDeployment(projectIds[2] || defaultProjectId, 'analytics-service', 'staging', 'Succeeded', 'v2.1.0-rc.3', 11, 100, 2);
    createSeedDeployment(projectIds[3] || defaultProjectId, 'notification-service', 'production', 'Rolled Back', 'v1.3.9', 18, 72, 3);
    createSeedDeployment(projectIds[4] || defaultProjectId, 'project-service', 'production', 'Succeeded', 'v1.9.1', 9, 98, 5);
  }

  if (rowCount('slos') === 0) {
    run(`INSERT INTO slos VALUES (?, ?, ?, ?, ?, ?)`, uuid(), 'api-gateway', '99.9% request availability', 99.9, 99.96, 82);
    run(`INSERT INTO slos VALUES (?, ?, ?, ?, ?, ?)`, uuid(), 'auth-service', 'p95 login under 350ms', 99.5, 99.1, 31);
    run(`INSERT INTO slos VALUES (?, ?, ?, ?, ?, ?)`, uuid(), 'project-service', '99.5% write availability', 99.5, 99.72, 64);
  }

  seedGithubSnapshot();
  seedKubernetesSnapshot();
  seedIncidents();
};

export const seedGithubSnapshot = () => {
  if (rowCount('github_repositories') > 0) return;

  const repoId = uuid();
  run(
    `INSERT INTO github_repositories VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    repoId,
    'devpilot-labs',
    'devpilot-ai',
    'devpilot-labs/devpilot-ai',
    'main',
    184,
    7,
    now(),
  );

  [
    ['9e8a7d1', 'feat: add release health dashboard', 'Ava Chen', daysAgo(0.6)],
    ['5bb4c20', 'fix: reduce auth token validation latency', 'Noah Patel', daysAgo(1.2)],
    ['44ad91f', 'chore: tune prometheus scrape intervals', 'Mia Torres', daysAgo(2.4)],
    ['1cab8ee', 'feat: incident analysis recommendations', 'Ishan Rao', daysAgo(4.8)],
  ].forEach(([sha, message, author, committedAt]) => {
    run(`INSERT OR REPLACE INTO github_commits VALUES (?, ?, ?, ?, ?, ?)`, sha, repoId, message, author, committedAt, `https://github.com/devpilot-labs/devpilot-ai/commit/${sha}`);
  });

  [
    ['101', 101, 'Add Kubernetes pod health panel', 'merged', 'Ava Chen', daysAgo(3), daysAgo(2.7)],
    ['102', 102, 'Improve AI incident summary prompt', 'open', 'Ishan Rao', daysAgo(1.4), null],
    ['103', 103, 'Fix gateway timeout retry policy', 'merged', 'Noah Patel', daysAgo(6), daysAgo(5.6)],
  ].forEach(([id, number, title, state, author, createdAt, mergedAt]) => {
    run(`INSERT OR REPLACE INTO github_pull_requests VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, id, repoId, number, title, state, author, createdAt, mergedAt, `https://github.com/devpilot-labs/devpilot-ai/pull/${number}`);
  });
};

export const seedKubernetesSnapshot = () => {
  if (rowCount('kubernetes_nodes') > 0) return;

  [
    ['ip-10-0-1-21', 'Ready', 8, 32, 63, 71],
    ['ip-10-0-2-34', 'Ready', 8, 32, 58, 66],
    ['ip-10-0-3-55', 'Ready', 16, 64, 74, 79],
  ].forEach(([name, status, cpuCores, memoryGi, cpuUsage, memoryUsage]) => {
    run(`INSERT INTO kubernetes_nodes VALUES (?, ?, ?, ?, ?, ?, ?)`, uuid(), name, status, cpuCores, memoryGi, cpuUsage, memoryUsage);
  });

  [
    ['api-gateway-774bd8f9d6-j8q2m', 'production', 'Running', 0, 410, 512, 'ip-10-0-1-21'],
    ['auth-service-67bc5f46f9-nd2vm', 'production', 'Running', 1, 260, 384, 'ip-10-0-2-34'],
    ['notification-worker-6d4d5f9bc9-82hdq', 'production', 'CrashLoopBackOff', 9, 120, 256, 'ip-10-0-3-55'],
    ['analytics-api-78c8dbb85f-2mqlg', 'staging', 'Running', 0, 350, 768, 'ip-10-0-3-55'],
  ].forEach(([name, namespace, status, restarts, cpuMillicores, memoryMi, nodeName]) => {
    run(`INSERT INTO kubernetes_pods VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, uuid(), name, namespace, status, restarts, cpuMillicores, memoryMi, nodeName);
  });

  [
    ['api-gateway', 'production', 4, 4, 'ghcr.io/devpilot/api-gateway:v1.8.4'],
    ['auth-service', 'production', 3, 3, 'ghcr.io/devpilot/auth-service:v1.5.2'],
    ['notification-worker', 'production', 2, 1, 'ghcr.io/devpilot/notification-worker:v1.3.9'],
    ['analytics-api', 'staging', 2, 2, 'ghcr.io/devpilot/analytics-api:v2.1.0-rc.3'],
  ].forEach(([name, namespace, desired, available, image]) => {
    run(`INSERT INTO kubernetes_deployments VALUES (?, ?, ?, ?, ?, ?)`, uuid(), name, namespace, desired, available, image);
  });
};

export const seedIncidents = () => {
  if (rowCount('incidents') > 0) return;

  const projectIds = all<{ id: string }>('SELECT id FROM projects ORDER BY created_at ASC').map((project) => project.id);
  const defaultProjectId = projectIds[0] || ensureDefaultProject();
  [
    [projectIds[3] || defaultProjectId, 'INC-1042', 'Notification worker crash loop', 'Queue consumer repeatedly restarts after the latest rollout.', 'High', 'Investigating', 'notification-service', daysAgo(0.35), null, 'Pod restart storm after queue consumer rollout.'],
    [projectIds[1] || defaultProjectId, 'INC-1037', 'Auth latency above target', 'Login requests are slower than expected during token validation.', 'Critical', 'Resolved', 'auth-service', daysAgo(3.2), daysAgo(3.05), 'Token introspection cache missed after config drift.'],
    [projectIds[2] || defaultProjectId, 'INC-1029', 'Analytics staging deploy rollback', 'Canary validation failed during analytics schema migration.', 'Medium', 'Resolved', 'analytics-service', daysAgo(5.4), daysAgo(5.1), 'Schema mismatch detected during canary validation.'],
  ].forEach(([projectId, id, title, description, severity, status, service, createdAt, resolvedAt, summary]) => {
    run(
      `INSERT INTO incidents (id, project_id, title, description, severity, status, service, created_at, resolved_at, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      projectId,
      title,
      description,
      severity,
      status,
      service,
      createdAt,
      resolvedAt,
      summary,
    );
  });
};

seedDatabase();

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
  service: row.service,
  environment: row.environment,
  status: row.status,
  version: row.version,
  startedAt: row.started_at,
  durationMinutes: row.duration_minutes,
  successRate: row.success_rate,
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
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const readStore = (): StoreState => ({
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
});

export const resetStore = () => {
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
  ].forEach((table) => run(`DELETE FROM ${table}`));
  seedDatabase();
  return readStore();
};

export const createTask = (input: Partial<Task>) => {
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
  all<any>('SELECT * FROM projects ORDER BY updated_at DESC').map(projectFromRow);

export const createProject = (input: Partial<Project>) => {
  const timestamp = now();
  const project: Project = {
    id: uuid(),
    name: String(input.name || 'Untitled project'),
    description: String(input.description || ''),
    owner: String(input.owner || 'Platform Team'),
    status: input.status || 'Active',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  run(
    `INSERT INTO projects VALUES (?, ?, ?, ?, ?, ?, ?)`,
    project.id,
    project.name,
    project.description,
    project.owner,
    project.status,
    project.createdAt,
    project.updatedAt,
  );
  return project;
};

export const updateProject = (id: string, patch: Partial<Project>) => {
  const existing = get<any>('SELECT * FROM projects WHERE id = ?', id);
  if (!existing) return undefined;

  const updated: Project = {
    ...projectFromRow(existing),
    ...patch,
    id,
    updatedAt: now(),
  };

  run(
    `UPDATE projects SET name = ?, description = ?, owner = ?, status = ?, updated_at = ? WHERE id = ?`,
    updated.name,
    updated.description,
    updated.owner,
    updated.status,
    updated.updatedAt,
    id,
  );
  return updated;
};

export const deleteProject = (id: string) => {
  const taskCount = get<{ count: number }>('SELECT COUNT(*) as count FROM tasks WHERE project_id = ?', id)?.count ?? 0;
  if (taskCount > 0) return false;
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return result.changes > 0;
};

export const deleteTask = (id: string) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
};

export const createDeployment = (input: Partial<Deployment>) => {
  const deployment: Deployment = {
    id: uuid(),
    projectId: String(input.projectId || ensureDefaultProject()),
    service: String(input.service || 'api-gateway'),
    environment: input.environment || 'staging',
    status: input.status || 'Queued',
    version: String(input.version || 'v0.0.1'),
    startedAt: String(input.startedAt || now()),
    durationMinutes: Number(input.durationMinutes || 0),
    successRate: Number(input.successRate || 0),
  };

  run(
    `INSERT INTO deployments (id, project_id, service, environment, status, version, started_at, duration_minutes, success_rate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    deployment.id,
    deployment.projectId,
    deployment.service,
    deployment.environment,
    deployment.status,
    deployment.version,
    deployment.startedAt,
    deployment.durationMinutes,
    deployment.successRate,
  );
  return deployment;
};

export const createIncident = (input: Partial<Incident>) => {
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

export const listIncidents = (): Incident[] =>
  all<any>('SELECT * FROM incidents ORDER BY created_at DESC').map((row) => ({
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
});
