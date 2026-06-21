"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseInfo = exports.resetStore = exports.listProjectHealthChecks = exports.recordProjectHealthCheck = exports.updateIncident = exports.createIncident = exports.listIncidents = exports.createDeployment = exports.deleteTask = exports.updateTask = exports.createTask = exports.deleteProject = exports.updateProject = exports.createProject = exports.findProjectByDeploymentWebhookToken = exports.listProjects = exports.readStore = exports.init = void 0;
const pg_1 = require("pg");
const uuid_1 = require("uuid");
const pool = process.env.DATABASE_URL
    ? new pg_1.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : null;
let initialized = null;
const now = () => new Date().toISOString();
const json = (value) => JSON.stringify(value);
const normalizeAppUrl = (value) => {
    const raw = String(value || '').trim();
    if (!raw)
        return '';
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeProjectKey = (value, fallback) => {
    const raw = String(value || '').trim().toUpperCase();
    const compact = raw.replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (compact)
        return compact;
    return String(fallback || 'PROJ')
        .split(/[\s-_]+/)
        .map((part) => part[0] || '')
        .join('')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6) || 'PROJ';
};
const normalizeProjectRole = (value) => {
    const role = String(value || '').trim().toLowerCase();
    if (role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer')
        return role;
    return 'member';
};
const normalizeProjectMembers = (members, ownerName, ownerEmail) => {
    const owner = {
        email: normalizeEmail(ownerEmail),
        name: String(ownerName || '').trim(),
        role: 'owner',
    };
    const deduped = new Map();
    if (owner.email)
        deduped.set(owner.email, owner);
    const source = Array.isArray(members) ? members : [];
    source.forEach((member) => {
        const candidate = member;
        const email = normalizeEmail(candidate?.email);
        if (!email)
            return;
        deduped.set(email, {
            email,
            name: String(candidate?.name || '').trim() || email,
            role: email === owner.email ? 'owner' : normalizeProjectRole(candidate?.role),
        });
    });
    return Array.from(deduped.values());
};
const normalizeStatus = (status) => {
    const value = String(status || '').trim();
    const aliases = {
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
const parseLabels = (value) => {
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    }
    catch {
        return [];
    }
};
const parseProjectMembers = (value, ownerName, ownerEmail) => {
    if (!value)
        return normalizeProjectMembers([], ownerName, ownerEmail);
    try {
        return normalizeProjectMembers(JSON.parse(value), ownerName, ownerEmail);
    }
    catch {
        return normalizeProjectMembers([], ownerName, ownerEmail);
    }
};
const query = async (text, params = []) => {
    if (!pool)
        throw new Error('DATABASE_URL is not configured');
    await (0, exports.init)();
    return pool.query(text, params);
};
const ensureProjectOwnerEmailColumn = async () => {
    try {
        await pool?.query(`ALTER TABLE projects ADD COLUMN owner_email TEXT NOT NULL DEFAULT ''`);
    }
    catch (error) {
        if (error?.code !== '42701')
            throw error;
    }
};
const ensureProjectDeploymentPlatformColumn = async () => {
    try {
        await pool?.query(`ALTER TABLE projects ADD COLUMN deployment_platform TEXT NOT NULL DEFAULT 'Other'`);
    }
    catch (error) {
        if (error?.code !== '42701')
            throw error;
    }
};
const ensureProjectMembersColumn = async () => {
    try {
        await pool?.query(`ALTER TABLE projects ADD COLUMN members_json TEXT NOT NULL DEFAULT '[]'`);
    }
    catch (error) {
        if (error?.code !== '42701')
            throw error;
    }
};
const ensureProjectKeyColumn = async () => {
    try {
        await pool?.query(`ALTER TABLE projects ADD COLUMN project_key TEXT NOT NULL DEFAULT 'PROJ'`);
    }
    catch (error) {
        if (error?.code !== '42701')
            throw error;
    }
};
const init = async () => {
    if (!pool)
        return;
    if (initialized)
        return initialized;
    initialized = (async () => {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_key TEXT NOT NULL DEFAULT 'PROJ',
        description TEXT NOT NULL,
        owner TEXT NOT NULL,
        owner_email TEXT NOT NULL DEFAULT '',
        members_json TEXT NOT NULL DEFAULT '[]',
        service_name TEXT NOT NULL DEFAULT '',
        deployment_platform TEXT NOT NULL DEFAULT 'Other',
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
        duration_minutes INTEGER NOT NULL
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
        await ensureProjectOwnerEmailColumn();
        await ensureProjectDeploymentPlatformColumn();
        await ensureProjectMembersColumn();
        await ensureProjectKeyColumn();
    })();
    return initialized;
};
exports.init = init;
const projectFromRow = (row) => ({
    id: row.id,
    name: row.name,
    projectKey: normalizeProjectKey(row.project_key, row.name),
    description: row.description,
    owner: row.owner,
    ownerEmail: row.owner_email || '',
    members: parseProjectMembers(row.members_json, row.owner, row.owner_email),
    serviceName: row.service_name || '',
    deploymentPlatform: row.deployment_platform || 'Other',
    appUrl: row.app_url || '',
    deploymentWebhookToken: row.deployment_webhook_token || '',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
});
const taskFromRow = (row) => ({
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
const deploymentFromRow = (row) => ({
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
const incidentFromRow = (row) => ({
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
});
const healthCheckFromRow = (row) => ({
    id: row.id,
    projectId: row.project_id,
    appUrl: row.app_url,
    status: row.status,
    statusCode: row.status_code,
    responseTimeMs: row.response_time_ms,
    checkedAt: row.checked_at,
    error: row.error || '',
});
const readStore = async () => ({
    projects: await (0, exports.listProjects)(),
    tasks: (await query('SELECT * FROM tasks ORDER BY updated_at DESC')).rows.map(taskFromRow),
    deployments: (await query('SELECT * FROM deployments ORDER BY started_at DESC')).rows.map(deploymentFromRow),
    slos: [],
    githubRepositories: [],
    githubCommits: [],
    githubPullRequests: [],
    kubernetesNodes: [],
    kubernetesPods: [],
    kubernetesDeployments: [],
    incidents: await (0, exports.listIncidents)(),
    projectHealthChecks: await (0, exports.listProjectHealthChecks)(),
});
exports.readStore = readStore;
const listProjects = async () => (await query('SELECT * FROM projects ORDER BY updated_at DESC')).rows.map(projectFromRow);
exports.listProjects = listProjects;
const findProjectByDeploymentWebhookToken = async (token) => {
    const result = await query('SELECT * FROM projects WHERE deployment_webhook_token = $1 LIMIT 1', [token]);
    return result.rows[0] ? projectFromRow(result.rows[0]) : undefined;
};
exports.findProjectByDeploymentWebhookToken = findProjectByDeploymentWebhookToken;
const createProject = async (input) => {
    const timestamp = now();
    const project = {
        id: (0, uuid_1.v4)(),
        name: String(input.name || 'Untitled project'),
        projectKey: normalizeProjectKey(input.projectKey, input.name || 'Untitled project'),
        description: String(input.description || ''),
        owner: String(input.owner || 'Platform Team'),
        ownerEmail: String(input.ownerEmail || ''),
        members: normalizeProjectMembers(input.members, input.owner || 'Platform Team', input.ownerEmail || ''),
        serviceName: String(input.serviceName || ''),
        deploymentPlatform: String(input.deploymentPlatform || 'Other'),
        appUrl: normalizeAppUrl(input.appUrl),
        deploymentWebhookToken: String(input.deploymentWebhookToken || (0, uuid_1.v4)()),
        status: input.status || 'Active',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
    await query(`INSERT INTO projects (id, name, project_key, description, owner, owner_email, members_json, service_name, deployment_platform, app_url, deployment_webhook_token, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [project.id, project.name, project.projectKey, project.description, project.owner, project.ownerEmail, json(project.members), project.serviceName, project.deploymentPlatform, project.appUrl, project.deploymentWebhookToken, project.status, project.createdAt, project.updatedAt]);
    return project;
};
exports.createProject = createProject;
const updateProject = async (id, patch) => {
    const existing = (await query('SELECT * FROM projects WHERE id = $1 LIMIT 1', [id])).rows[0];
    if (!existing)
        return undefined;
    const current = projectFromRow(existing);
    const updated = { ...current, ...patch, id, updatedAt: now() };
    updated.projectKey = normalizeProjectKey(updated.projectKey, updated.name);
    updated.members = normalizeProjectMembers(updated.members, updated.owner, updated.ownerEmail);
    updated.appUrl = normalizeAppUrl(updated.appUrl);
    await query(`UPDATE projects SET name=$1, project_key=$2, description=$3, owner=$4, owner_email=$5, members_json=$6, service_name=$7, deployment_platform=$8, app_url=$9, deployment_webhook_token=$10, status=$11, updated_at=$12 WHERE id=$13`, [updated.name, updated.projectKey, updated.description, updated.owner, updated.ownerEmail, json(updated.members), updated.serviceName, updated.deploymentPlatform, updated.appUrl, updated.deploymentWebhookToken || (0, uuid_1.v4)(), updated.status, updated.updatedAt, id]);
    return updated;
};
exports.updateProject = updateProject;
const deleteProject = async (id) => {
    const taskCount = Number((await query('SELECT COUNT(*)::int AS count FROM tasks WHERE project_id = $1', [id])).rows[0]?.count || 0);
    if (taskCount > 0)
        return false;
    const result = await query('DELETE FROM projects WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
};
exports.deleteProject = deleteProject;
const createTask = async (input) => {
    const timestamp = now();
    const task = {
        id: (0, uuid_1.v4)(),
        projectId: String(input.projectId || ''),
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
    await query(`INSERT INTO tasks (id, project_id, title, description, type, status, priority, assignee, points, due, labels, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`, [task.id, task.projectId, task.title, task.description, task.type, task.status, task.priority, task.assignee, task.points, task.due, json(task.labels), task.createdAt, task.updatedAt]);
    return task;
};
exports.createTask = createTask;
const updateTask = async (id, patch) => {
    const row = (await query('SELECT * FROM tasks WHERE id = $1 LIMIT 1', [id])).rows[0];
    if (!row)
        return undefined;
    const current = taskFromRow(row);
    const updated = { ...current, ...patch, id, status: patch.status ? normalizeStatus(patch.status) : current.status, labels: Array.isArray(patch.labels) ? patch.labels.map(String) : current.labels, updatedAt: now() };
    await query(`UPDATE tasks SET project_id=$1,title=$2,description=$3,type=$4,status=$5,priority=$6,assignee=$7,points=$8,due=$9,labels=$10,updated_at=$11 WHERE id=$12`, [updated.projectId, updated.title, updated.description, updated.type, updated.status, updated.priority, updated.assignee, updated.points, updated.due, json(updated.labels), updated.updatedAt, id]);
    return updated;
};
exports.updateTask = updateTask;
const deleteTask = async (id) => ((await query('DELETE FROM tasks WHERE id = $1', [id])).rowCount || 0) > 0;
exports.deleteTask = deleteTask;
const createDeployment = async (input) => {
    const existing = input.externalId
        ? (await query('SELECT * FROM deployments WHERE project_id = $1 AND external_id = $2 LIMIT 1', [String(input.projectId || ''), String(input.externalId)])).rows[0]
        : undefined;
    const deployment = {
        id: existing?.id || (0, uuid_1.v4)(),
        projectId: String(input.projectId || ''),
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
        await query(`UPDATE deployments SET provider=$1,service=$2,environment=$3,status=$4,version=$5,deployment_url=$6,commit_sha=$7,branch=$8,triggered_by=$9,external_id=$10,started_at=$11,duration_minutes=$12 WHERE id=$13`, [deployment.provider, deployment.service, deployment.environment, deployment.status, deployment.version, deployment.deploymentUrl, deployment.commitSha, deployment.branch, deployment.triggeredBy, deployment.externalId, deployment.startedAt, deployment.durationMinutes, deployment.id]);
        return deployment;
    }
    await query(`INSERT INTO deployments (id, project_id, provider, service, environment, status, version, deployment_url, commit_sha, branch, triggered_by, external_id, started_at, duration_minutes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, [deployment.id, deployment.projectId, deployment.provider, deployment.service, deployment.environment, deployment.status, deployment.version, deployment.deploymentUrl, deployment.commitSha, deployment.branch, deployment.triggeredBy, deployment.externalId, deployment.startedAt, deployment.durationMinutes]);
    return deployment;
};
exports.createDeployment = createDeployment;
const listIncidents = async () => (await query('SELECT * FROM incidents ORDER BY created_at DESC')).rows.map(incidentFromRow);
exports.listIncidents = listIncidents;
const createIncident = async (input) => {
    const incident = {
        id: String(input.id || `INC-${Date.now()}`),
        projectId: String(input.projectId || ''),
        title: String(input.title || 'Untitled incident'),
        description: String(input.description || ''),
        severity: input.severity || 'Medium',
        status: input.status || 'Open',
        service: String(input.service || 'api-gateway'),
        createdAt: String(input.createdAt || now()),
        resolvedAt: input.resolvedAt || null,
        summary: String(input.summary || input.description || ''),
    };
    await query(`INSERT INTO incidents (id, project_id, title, description, severity, status, service, created_at, resolved_at, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [incident.id, incident.projectId, incident.title, incident.description, incident.severity, incident.status, incident.service, incident.createdAt, incident.resolvedAt, incident.summary]);
    return incident;
};
exports.createIncident = createIncident;
const updateIncident = async (id, patch) => {
    const row = (await query('SELECT * FROM incidents WHERE id = $1 LIMIT 1', [id])).rows[0];
    if (!row)
        return undefined;
    const current = incidentFromRow(row);
    const updated = { ...current, ...patch, id, resolvedAt: patch.status === 'Resolved' && !patch.resolvedAt ? now() : patch.resolvedAt ?? current.resolvedAt };
    await query(`UPDATE incidents SET project_id=$1,title=$2,description=$3,severity=$4,status=$5,service=$6,resolved_at=$7,summary=$8 WHERE id=$9`, [updated.projectId, updated.title, updated.description, updated.severity, updated.status, updated.service, updated.resolvedAt, updated.summary || updated.description, id]);
    return updated;
};
exports.updateIncident = updateIncident;
const recordProjectHealthCheck = async (input) => {
    const check = { id: (0, uuid_1.v4)(), checkedAt: input.checkedAt || now(), ...input };
    await query(`INSERT INTO project_health_checks (id, project_id, app_url, status, status_code, response_time_ms, checked_at, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [check.id, check.projectId, check.appUrl, check.status, check.statusCode, check.responseTimeMs, check.checkedAt, check.error]);
    await query(`DELETE FROM project_health_checks WHERE project_id=$1 AND id NOT IN (
      SELECT id FROM project_health_checks WHERE project_id=$1 ORDER BY checked_at DESC LIMIT 100
    )`, [check.projectId]);
    return check;
};
exports.recordProjectHealthCheck = recordProjectHealthCheck;
const listProjectHealthChecks = async (projectId) => {
    const result = projectId
        ? await query('SELECT * FROM project_health_checks WHERE project_id = $1 ORDER BY checked_at DESC', [projectId])
        : await query('SELECT * FROM project_health_checks ORDER BY checked_at DESC');
    return result.rows.map(healthCheckFromRow);
};
exports.listProjectHealthChecks = listProjectHealthChecks;
const resetStore = async () => {
    await query('DELETE FROM project_health_checks');
    await query('DELETE FROM incidents');
    await query('DELETE FROM deployments');
    await query('DELETE FROM tasks');
    await query('DELETE FROM projects');
    return (0, exports.readStore)();
};
exports.resetStore = resetStore;
const databaseInfo = () => ({ engine: 'Postgres', path: 'DATABASE_URL', tables: ['projects', 'tasks', 'deployments', 'incidents', 'project_health_checks'] });
exports.databaseInfo = databaseInfo;
