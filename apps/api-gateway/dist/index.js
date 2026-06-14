"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = require("body-parser");
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const realtime_1 = require("./realtime");
const rbac_1 = require("./rbac");
const activity_1 = require("./activity");
const search_1 = require("./search");
const uploads_1 = require("./uploads");
const analytics_1 = require("./analytics");
const jobs_1 = require("./jobs");
const store_1 = require("./store");
const metrics_1 = require("./metrics");
const grafanaCloud_1 = require("./grafanaCloud");
exports.app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const server = http_1.default.createServer(exports.app);
const realtime = (0, realtime_1.createRealtimeServer)(server);
const isServerless = process.env.VERCEL === '1';
const requesterEmail = (req) => String(req.header('x-user-email') || '').trim().toLowerCase();
const requesterName = (req) => String(req.header('x-user') || '').trim();
const projectOwnedBy = (project, email) => Boolean(email) && (project.ownerEmail || '').trim().toLowerCase() === email;
const requireRequesterEmail = (req, res) => {
    const email = requesterEmail(req);
    if (!email) {
        res.status(401).json({ error: 'Login required' });
        return undefined;
    }
    return email;
};
const ownedProjects = (projects, email) => projects.filter((project) => projectOwnedBy(project, email));
const normalizeDeploymentStatus = (status) => {
    const value = String(status || '').trim().toLowerCase();
    if (['success', 'succeeded', 'ready', 'completed', 'complete'].includes(value))
        return 'Succeeded';
    if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(value))
        return 'Failed';
    if (['running', 'in_progress', 'in-progress', 'building', 'deploying'].includes(value))
        return 'Running';
    if (['rolled_back', 'rolled-back', 'rollback'].includes(value))
        return 'Rolled Back';
    return 'Queued';
};
const normalizeDeploymentProvider = (provider) => {
    const value = String(provider || '').trim().toLowerCase();
    const providers = {
        vercel: 'Vercel',
        github: 'GitHub Actions',
        'github actions': 'GitHub Actions',
        github_actions: 'GitHub Actions',
        railway: 'Railway',
        render: 'Render',
        manual: 'Manual',
    };
    return providers[value] || (value ? 'Other' : 'Manual');
};
const deploymentProviderFromPlatform = (platform) => {
    const value = String(platform || '').trim().toLowerCase();
    if (value === 'github-pages' || value === 'github')
        return 'GitHub Actions';
    if (value === 'vercel')
        return 'Vercel';
    if (value === 'railway')
        return 'Railway';
    if (value === 'render')
        return 'Render';
    return 'Other';
};
const normalizeDeploymentEnvironment = (environment) => String(environment || '').trim().toLowerCase() === 'production' ? 'production' : 'staging';
const normalizeDeploymentTimestamp = (value) => {
    if (!value)
        return new Date().toISOString();
    const numeric = Number(value);
    const parsed = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const classifyProjectHealth = (statusCode, responseTimeMs, error = '') => {
    if (error || statusCode >= 500 || statusCode === 0)
        return 'down';
    if (statusCode >= 400 || responseTimeMs > 1500)
        return 'warning';
    return 'healthy';
};
const checkProjectAppUrl = (projectId, appUrl) => new Promise((resolve) => {
    const startedAt = Date.now();
    let url;
    try {
        url = new URL(appUrl);
    }
    catch {
        resolve({ statusCode: 0, responseTimeMs: 0, error: 'Invalid app URL' });
        return;
    }
    const client = url.protocol === 'https:' ? https_1.default : http_1.default;
    const request = client.get(url, { timeout: 5000, headers: { 'user-agent': `DevPilot Health Checker/${projectId}` } }, (response) => {
        response.resume();
        response.on('end', () => {
            resolve({
                statusCode: response.statusCode || 0,
                responseTimeMs: Date.now() - startedAt,
                error: '',
            });
        });
    });
    request.setTimeout(5000, () => {
        request.destroy();
        resolve({ statusCode: 0, responseTimeMs: Date.now() - startedAt, error: 'Health check timed out' });
    });
    request.on('error', (error) => {
        resolve({ statusCode: 0, responseTimeMs: Date.now() - startedAt, error: error.message });
    });
});
const recordProjectHealthForProject = async (project) => {
    const result = await checkProjectAppUrl(project.id, project.appUrl);
    const status = classifyProjectHealth(result.statusCode, result.responseTimeMs, result.error);
    const check = await (0, store_1.recordProjectHealthCheck)({
        projectId: project.id,
        appUrl: project.appUrl,
        status,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        error: result.error,
    });
    if (status === 'down') {
        recordIncidentIfMissing({
            projectId: project.id,
            title: `Application health check failed: ${project.name}`,
            description: result.error || `${project.appUrl} returned HTTP ${result.statusCode}.`,
            severity: 'High',
            service: project.serviceName,
            actor: 'project-health-checker',
        });
    }
    realtime.broadcast({ type: 'project.health.checked', payload: check });
    return check;
};
const ensureRecentProjectHealthCheck = async (project, checks) => {
    if (!project.appUrl || project.status !== 'Active')
        return undefined;
    const latest = checks.find((check) => check.projectId === project.id);
    if (latest && Date.now() - new Date(latest.checkedAt).getTime() < 25000)
        return latest;
    return recordProjectHealthForProject(project);
};
const runProjectHealthChecks = async () => {
    const projects = (await (0, store_1.listProjectsAsync)()).filter((project) => project.status === 'Active' && project.appUrl);
    await Promise.all(projects.map(recordProjectHealthForProject));
};
const syncGrafanaCloud = async (reason, options = {}) => {
    try {
        return await (0, grafanaCloud_1.pushMetricsToGrafanaCloud)(reason, options);
    }
    catch (error) {
        console.error('Grafana Cloud push failed', reason, error);
        return { pushed: false, reason: 'push failed' };
    }
};
const deploymentFromWebhookPayload = (projectId, body) => ({
    projectId,
    provider: normalizeDeploymentProvider(body.provider || body.source || body.deployment?.provider),
    service: String(body.service || body.serviceName || body.name || body.deployment?.service || 'application-service'),
    environment: normalizeDeploymentEnvironment(body.environment || body.target || body.deployment?.environment || 'production'),
    status: normalizeDeploymentStatus(body.status || body.conclusion || body.state || body.deployment?.status),
    version: String(body.version || body.release || body.tag || body.sha || body.commitSha || body.deployment?.version || `deploy-${Date.now()}`),
    deploymentUrl: String(body.deploymentUrl || body.url || body.html_url || body.deploy_url || body.deployment?.url || ''),
    commitSha: String(body.commitSha || body.sha || body.head_sha || body.commit?.sha || body.deployment?.commitSha || ''),
    branch: String(body.branch || body.ref || body.git?.branch || body.deployment?.branch || ''),
    triggeredBy: String(body.triggeredBy || body.actor || body.sender?.login || body.user?.login || body.deployment?.triggeredBy || ''),
    externalId: String(body.externalId || body.id || body.deployment?.id || ''),
    startedAt: String(body.deployedAt || body.startedAt || body.createdAt || body.created_at || new Date().toISOString()),
    durationMinutes: Number(body.durationMinutes || body.duration || 0),
});
const deploymentFromVercelPayload = (projectId, serviceName, body) => {
    const payload = body.payload || body;
    const deployment = payload.deployment || payload;
    const meta = deployment.meta || payload.meta || {};
    const eventType = String(body.type || payload.type || deployment.type || '').toLowerCase();
    const deploymentId = deployment.id || payload.id || body.id || deployment.uid || '';
    const deploymentUrl = deployment.url
        ? String(deployment.url).startsWith('http') ? String(deployment.url) : `https://${deployment.url}`
        : String(payload.url || body.url || '');
    const commitSha = meta.githubCommitSha || meta.gitCommitSha || payload.gitSource?.sha || payload.sha || deployment.sha || '';
    const branch = meta.githubCommitRef || meta.gitCommitRef || payload.gitSource?.ref || payload.target || deployment.target || '';
    const status = eventType.includes('error') || eventType.includes('failed')
        ? 'Failed'
        : eventType.includes('ready') || eventType.includes('succeeded') || eventType.includes('success')
            ? 'Succeeded'
            : normalizeDeploymentStatus(deployment.state || payload.state || body.status);
    return {
        projectId,
        provider: 'Vercel',
        service: String(serviceName || payload.name || deployment.name || 'vercel-app'),
        environment: normalizeDeploymentEnvironment(payload.target || deployment.target || meta.vercelTarget || 'production'),
        status,
        version: String(payload.name || deployment.name || (commitSha ? String(commitSha).slice(0, 7) : deploymentId || `vercel-${Date.now()}`)),
        deploymentUrl,
        commitSha: String(commitSha),
        branch: String(branch),
        triggeredBy: String(meta.githubCommitAuthorName || payload.user?.username || payload.creator?.username || body.user?.username || 'vercel'),
        externalId: String(deploymentId),
        startedAt: normalizeDeploymentTimestamp(deployment.createdAt || payload.createdAt || body.createdAt),
        durationMinutes: 0,
    };
};
const deploymentFromGitHubPayload = (projectId, serviceName, body) => {
    const deployment = body.deployment || {};
    const deploymentStatus = body.deployment_status || {};
    const repository = body.repository || {};
    const commitSha = deployment.sha || body.workflow_run?.head_sha || body.check_run?.head_sha || '';
    const deploymentUrl = deploymentStatus.environment_url || deploymentStatus.target_url || deploymentStatus.log_url || repository.html_url || '';
    return {
        projectId,
        provider: 'GitHub Actions',
        service: String(serviceName || repository.name || 'github-actions'),
        environment: normalizeDeploymentEnvironment(deployment.environment || deploymentStatus.environment || 'production'),
        status: normalizeDeploymentStatus(deploymentStatus.state || body.workflow_run?.conclusion || body.action),
        version: String(commitSha ? String(commitSha).slice(0, 7) : deployment.id || body.workflow_run?.id || `github-${Date.now()}`),
        deploymentUrl: String(deploymentUrl),
        commitSha: String(commitSha),
        branch: String(deployment.ref || body.workflow_run?.head_branch || ''),
        triggeredBy: String(body.sender?.login || body.workflow_run?.actor?.login || 'github'),
        externalId: String(deploymentStatus.id || deployment.id || body.workflow_run?.id || ''),
        startedAt: normalizeDeploymentTimestamp(deploymentStatus.created_at || deployment.created_at || body.workflow_run?.created_at),
        durationMinutes: 0,
    };
};
const deploymentFromGitHubPushPayload = (projectId, serviceName, body) => {
    const repository = body.repository || {};
    const commitSha = String(body.after || body.head_commit?.id || '');
    const branch = String(body.ref || '').replace(/^refs\/heads\//, '');
    return {
        projectId,
        provider: 'GitHub Actions',
        service: String(serviceName || repository.name || 'github-pages'),
        environment: 'production',
        status: 'Succeeded',
        version: String(commitSha ? commitSha.slice(0, 7) : `github-push-${Date.now()}`),
        deploymentUrl: String(repository.homepage || repository.html_url || ''),
        commitSha,
        branch,
        triggeredBy: String(body.pusher?.name || body.sender?.login || 'github'),
        externalId: String(body.after || body.head_commit?.id || `${repository.id || 'github'}-${Date.now()}`),
        startedAt: normalizeDeploymentTimestamp(body.head_commit?.timestamp || body.repository?.updated_at || new Date().toISOString()),
        durationMinutes: 0,
    };
};
const deploymentFromGitHubPageBuildPayload = (projectId, serviceName, body) => {
    const repository = body.repository || {};
    const build = body.build || {};
    const error = build.error || {};
    const commitSha = String(build.commit || '');
    return {
        projectId,
        provider: 'GitHub Actions',
        service: String(serviceName || repository.name || 'github-pages'),
        environment: 'production',
        status: error.message ? 'Failed' : 'Succeeded',
        version: String(commitSha ? commitSha.slice(0, 7) : `page-build-${Date.now()}`),
        deploymentUrl: String(repository.homepage || repository.html_url || ''),
        commitSha,
        branch: String(build.pusher || ''),
        triggeredBy: String(build.pusher || body.sender?.login || 'github-pages'),
        externalId: String(build.id || commitSha || `${repository.id || 'github-pages'}-${Date.now()}`),
        startedAt: normalizeDeploymentTimestamp(build.created_at || new Date().toISOString()),
        durationMinutes: 0,
    };
};
const deploymentFromGitHubEvent = (projectId, serviceName, githubEvent, body) => {
    if (['deployment_status', 'workflow_run', 'check_run'].includes(githubEvent) || body?.deployment_status || body?.workflow_run || body?.check_run) {
        return deploymentFromGitHubPayload(projectId, serviceName, body);
    }
    if (githubEvent === 'push') {
        return deploymentFromGitHubPushPayload(projectId, serviceName, body);
    }
    if (githubEvent === 'page_build') {
        return deploymentFromGitHubPageBuildPayload(projectId, serviceName, body);
    }
    return null;
};
const recordIncidentIfMissing = async (input) => {
    const alreadyOpen = (await (0, store_1.listIncidentsAsync)()).some((incident) => incident.projectId === input.projectId &&
        incident.service === input.service &&
        incident.title === input.title &&
        incident.status !== 'Resolved');
    if (alreadyOpen)
        return undefined;
    const incident = await (0, store_1.createIncident)({
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        status: 'Open',
        service: input.service,
        summary: input.description,
    });
    (0, metrics_1.observeIncidentCreated)();
    (0, activity_1.recordActivity)({
        actor: input.actor,
        role: 'system',
        action: `incident.created:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.created', payload: incident });
    return incident;
};
const recordDeploymentFailureIncident = async (deployment, actor) => {
    if (!['Failed', 'Rolled Back'].includes(deployment.status))
        return;
    await recordIncidentIfMissing({
        projectId: deployment.projectId,
        title: `Deployment ${deployment.status}: ${deployment.version}`,
        description: `${deployment.provider} reported ${deployment.status.toLowerCase()} for ${deployment.service} ${deployment.version}.`,
        severity: deployment.status === 'Failed' ? 'High' : 'Medium',
        service: deployment.service,
        actor,
    });
};
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
});
// Middleware
exports.app.set('trust proxy', 1);
exports.app.use((0, cors_1.default)());
exports.app.use((0, body_parser_1.json)());
exports.app.use(limiter);
exports.app.use(metrics_1.prometheusMiddleware);
// TODO(gateway): introduce structured request logging with correlation IDs
// TECH-DEBT(gateway): move proxy route configuration to config service
exports.app.use((req, _res, next) => {
    (0, analytics_1.bump)('requests');
    next();
});
exports.app.get('/', (_req, res) => {
    res.json({
        service: 'API Gateway',
        status: 'running',
        version: '1.0.0',
        endpoints: [
            '/health',
            '/api/dashboard',
            '/api/projects',
            '/api/tasks',
            '/api/deployments',
            '/api/incidents',
            '/api/service-health',
            '/metrics',
            '/activity',
        ]
    });
});
exports.app.get('/api/dashboard', async (_req, res) => {
    const email = requireRequesterEmail(_req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const projects = ownedProjects(store.projects, email);
    const projectIds = new Set(projects.map((project) => project.id));
    const tasks = store.tasks.filter((task) => projectIds.has(task.projectId));
    const incidents = store.incidents.filter((incident) => projectIds.has(incident.projectId));
    const deployments = store.deployments.filter((deployment) => projectIds.has(deployment.projectId));
    const healthChecks = store.projectHealthChecks.filter((check) => projectIds.has(check.projectId));
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const completedTasks = tasks.filter((task) => task.status === 'DONE').length;
    const openTrackedIncidents = incidents.filter((incident) => incident.status !== 'Resolved').length;
    const deploymentsThisWeek = deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= oneWeekAgo).length;
    const latestHealthByProject = new Map();
    healthChecks.forEach((check) => {
        if (!latestHealthByProject.has(check.projectId)) {
            latestHealthByProject.set(check.projectId, check);
        }
    });
    res.json({
        metrics: [
            { label: 'Total Projects', value: String(projects.length) },
            { label: 'Open Tasks', value: String(tasks.filter((task) => task.status !== 'DONE').length) },
            { label: 'Completed Tasks', value: String(completedTasks) },
            { label: 'Open Incidents', value: String(openTrackedIncidents) },
            { label: 'Deployments This Week', value: String(deploymentsThisWeek) },
        ],
        timeline: deployments.map((deployment) => ({
            title: `${deployment.service} ${deployment.status}`,
            owner: deployment.environment,
            time: new Date(deployment.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })),
        deployments: deployments.slice(0, 5),
        incidents: incidents.filter((incident) => incident.status !== 'Resolved').slice(0, 5),
        projectHealth: projects.map((project) => {
            const latest = latestHealthByProject.get(project.id);
            return {
                projectId: project.id,
                name: project.name,
                serviceName: project.serviceName,
                appUrl: project.appUrl,
                status: latest?.status || 'unknown',
                statusCode: latest?.statusCode || null,
                responseTimeMs: latest?.responseTimeMs || null,
                checkedAt: latest?.checkedAt || null,
            };
        }),
    });
});
exports.app.get('/api/database', (_req, res) => {
    res.json((0, store_1.databaseInfo)());
});
exports.app.get('/api/projects', async (_req, res) => {
    const email = requireRequesterEmail(_req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const projects = ownedProjects(store.projects, email).map((project) => ({
        ...project,
        taskCount: store.tasks.filter((task) => task.projectId === project.id).length,
        openTasks: store.tasks.filter((task) => task.projectId === project.id && task.status !== 'DONE').length,
        openIncidents: store.incidents.filter((incident) => incident.projectId === project.id && incident.status !== 'Resolved').length,
    }));
    res.json({ projects });
});
exports.app.post('/api/projects', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const project = await (0, store_1.createProject)({ ...(req.body || {}), owner: req.body?.owner || requesterName(req) || 'Workspace Owner', ownerEmail: email });
    (0, metrics_1.observeProjectCreated)();
    (0, activity_1.recordActivity)({
        actor: requesterName(req) || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `project.created:${project.name}`,
    });
    await syncGrafanaCloud('project.created');
    realtime.broadcast({ type: 'project.created', payload: project });
    res.status(201).json({ project });
});
exports.app.patch('/api/projects/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const current = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === req.params.id);
    if (!current || !projectOwnedBy(current, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const project = await (0, store_1.updateProject)(req.params.id, req.body || {});
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'appUrl') && project.appUrl) {
        await recordProjectHealthForProject(project).catch((error) => console.error('Project health check failed', error));
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `project.updated:${project.name}`,
    });
    await syncGrafanaCloud('project.updated');
    realtime.broadcast({ type: 'project.updated', payload: project });
    res.json({ project });
});
exports.app.delete('/api/projects/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const current = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === req.params.id);
    if (!current || !projectOwnedBy(current, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const deleted = await (0, store_1.deleteProject)(req.params.id);
    if (!deleted) {
        res.status(409).json({ error: 'Project still has tasks or does not exist' });
        return;
    }
    res.json({ ok: true });
});
exports.app.get('/api/projects/:projectId/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === req.params.projectId);
    res.json({ tasks });
});
exports.app.get('/api/projects/:projectId/summary', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === project.id);
    const deployments = store.deployments.filter((deployment) => deployment.projectId === project.id);
    const incidents = store.incidents.filter((incident) => incident.projectId === project.id);
    await ensureRecentProjectHealthCheck(project, store.projectHealthChecks).catch((error) => console.error('Project health check failed', error));
    const healthChecks = (await (0, store_1.listProjectHealthChecksAsync)(project.id)).slice(0, 50);
    await syncGrafanaCloud('project.summary');
    res.json({ project, tasks, deployments, incidents, healthChecks });
});
exports.app.get('/api/projects/:projectId/health-checks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const project = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    res.json({ healthChecks: (await (0, store_1.listProjectHealthChecksAsync)(req.params.projectId)).slice(0, 50) });
});
exports.app.get('/api/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const projectId = String(req.query.projectId || '');
    const store = await (0, store_1.readStoreAsync)();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const tasks = store.tasks.filter((task) => projectIds.has(task.projectId) && (!projectId || task.projectId === projectId));
    res.json({ tasks });
});
exports.app.post('/api/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const project = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const task = await (0, store_1.createTask)(req.body || {});
    (0, metrics_1.observeTaskCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `task.created:${task.title}`,
    });
    await syncGrafanaCloud('task.created');
    realtime.broadcast({ type: 'task.created', payload: task });
    res.status(201).json({ task });
});
exports.app.patch('/api/tasks/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const existing = store.tasks.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    const task = await (0, store_1.updateTask)(req.params.id, req.body || {});
    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: req.body?.status === 'DONE' ? `task.completed:${task.title}` : req.body?.status ? `task.updated:${task.title}` : `task.updated:${task.title}`,
    });
    await syncGrafanaCloud('task.updated');
    realtime.broadcast({ type: 'task.updated', payload: task });
    res.json({ task });
});
exports.app.delete('/api/tasks/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const existing = store.tasks.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    const deleted = await (0, store_1.deleteTask)(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `task.deleted:${req.params.id}`,
    });
    realtime.broadcast({ type: 'task.deleted', payload: { id: req.params.id } });
    res.json({ ok: true });
});
exports.app.get('/api/deployments', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const projectId = String(req.query.projectId || '');
    const store = await (0, store_1.readStoreAsync)();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const deployments = store.deployments.filter((deployment) => projectIds.has(deployment.projectId) && (!projectId || deployment.projectId === projectId));
    res.json({ deployments });
});
exports.app.post('/api/deployments', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const project = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const deployment = await (0, store_1.createDeployment)(req.body || {});
    (0, metrics_1.observeDeploymentCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'release',
        role: (0, rbac_1.getRole)(req),
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.created');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});
exports.app.post('/api/projects/:projectId/deployments/webhook', async (req, res) => {
    const project = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === req.params.projectId);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const deployment = await (0, store_1.createDeployment)(deploymentFromWebhookPayload(project.id, req.body || {}));
    (0, metrics_1.observeDeploymentCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || deployment.triggeredBy || deployment.provider,
        role: (0, rbac_1.getRole)(req),
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.webhook');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});
const handleDeploymentWebhook = async (req, res) => {
    if (String(req.header('x-github-event') || '').toLowerCase() === 'ping') {
        res.json({ ok: true, message: 'DevPilot deployment webhook is reachable.' });
        return;
    }
    const project = await (0, store_1.findProjectByDeploymentWebhookToken)(req.params.token);
    if (!project) {
        res.status(404).json({ error: 'Deployment webhook not found' });
        return;
    }
    const githubEvent = String(req.header('x-github-event') || '').toLowerCase();
    const rawProvider = req.body?.provider || req.body?.source || req.body?.type?.split('.')?.[0];
    const provider = rawProvider
        ? normalizeDeploymentProvider(rawProvider)
        : deploymentProviderFromPlatform(req.params.platform || project.deploymentPlatform);
    const githubDeployment = deploymentFromGitHubEvent(project.id, project.serviceName, githubEvent, req.body || {});
    const deploymentInput = githubDeployment
        ? githubDeployment
        : provider === 'Vercel' || String(req.body?.type || '').toLowerCase().startsWith('deployment.')
            ? deploymentFromVercelPayload(project.id, project.serviceName, req.body || {})
            : {
                ...deploymentFromWebhookPayload(project.id, req.body || {}),
                service: req.body?.service || req.body?.serviceName || project.serviceName || 'application-service',
            };
    const deployment = await (0, store_1.createDeployment)(deploymentInput);
    (0, metrics_1.observeDeploymentCreated)();
    (0, activity_1.recordActivity)({
        actor: deployment.triggeredBy || deployment.provider,
        role: 'system',
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.platform-webhook');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
};
exports.app.post('/webhooks/deployments/:token', handleDeploymentWebhook);
exports.app.post('/webhooks/deployments/:platform/:token', handleDeploymentWebhook);
exports.app.get('/api/slos', async (_req, res) => {
    res.json({ slos: (await (0, store_1.readStoreAsync)()).slos });
});
exports.app.get('/api/incidents', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const projectId = String(req.query.projectId || '');
    const store = await (0, store_1.readStoreAsync)();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const incidents = store.incidents.filter((incident) => projectIds.has(incident.projectId) && (!projectId || incident.projectId === projectId));
    res.json({ incidents });
});
exports.app.post('/api/incidents', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const project = (await (0, store_1.listProjectsAsync)()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const incident = await (0, store_1.createIncident)(req.body || {});
    (0, metrics_1.observeIncidentCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'support',
        role: (0, rbac_1.getRole)(req),
        action: `incident.created:${incident.title}`,
    });
    await syncGrafanaCloud('incident.created');
    realtime.broadcast({ type: 'incident.created', payload: incident });
    res.status(201).json({ incident });
});
exports.app.patch('/api/incidents/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email)
        return;
    const store = await (0, store_1.readStoreAsync)();
    const existing = store.incidents.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Incident not found' });
        return;
    }
    const incident = await (0, store_1.updateIncident)(req.params.id, req.body || {});
    if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'support',
        role: (0, rbac_1.getRole)(req),
        action: `incident.updated:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.updated', payload: incident });
    res.json({ incident });
});
exports.app.post('/api/tasks/reset', async (_req, res) => {
    const store = await (0, store_1.resetStore)();
    res.json({ tasks: store.tasks });
});
const healthPayload = (service) => ({
    status: 'healthy',
    service,
    timestamp: new Date().toISOString(),
});
const serviceChecks = [
    { name: 'API Gateway', service: 'api-gateway', path: '/gateway/health', url: process.env.GATEWAY_HEALTH_URL || 'http://localhost:3000/gateway/health' },
    { name: 'Auth Service', service: 'auth-service', path: '/auth/health', url: process.env.AUTH_HEALTH_URL || 'http://localhost:3001/health' },
    { name: 'Project Service', service: 'project-service', path: '/project/health', url: process.env.PROJECT_HEALTH_URL || 'http://localhost:3002/health' },
    { name: 'Analytics Service', service: 'analytics-service', path: '/analytics/health', url: process.env.ANALYTICS_HEALTH_URL || 'http://localhost:3003/health' },
    { name: 'Notification Service', service: 'notification-service', path: '/notification/health', url: process.env.NOTIFICATION_HEALTH_URL || 'http://localhost:3004/health' },
];
const checkUrl = (url) => new Promise((resolve) => {
    const request = http_1.default.get(url, (response) => {
        response.resume();
        resolve(response.statusCode ? response.statusCode >= 200 && response.statusCode < 300 : false);
    });
    request.setTimeout(1200, () => {
        request.destroy();
        resolve(false);
    });
    request.on('error', () => resolve(false));
});
exports.app.get('/health', (_req, res) => {
    res.json(healthPayload('api-gateway'));
});
exports.app.get('/gateway/health', (_req, res) => {
    res.json(healthPayload('api-gateway'));
});
exports.app.get('/auth/health', (_req, res) => {
    res.json(healthPayload('auth-service'));
});
exports.app.get('/project/health', (_req, res) => {
    res.json(healthPayload('project-service'));
});
exports.app.get('/analytics/health', (_req, res) => {
    res.json(healthPayload('analytics-service'));
});
exports.app.get('/notification/health', (_req, res) => {
    res.json(healthPayload('notification-service'));
});
exports.app.get('/api/service-health', async (_req, res) => {
    const services = await Promise.all(serviceChecks.map(async (service) => {
        const healthy = await checkUrl(service.url);
        return {
            name: service.name,
            path: service.path,
            service: service.service,
            status: healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
        };
    }));
    const projects = await (0, store_1.listProjectsAsync)();
    services
        .filter((service) => service.status === 'unhealthy')
        .forEach((service) => {
        projects
            .filter((project) => project.serviceName === service.service)
            .forEach((project) => {
            recordIncidentIfMissing({
                projectId: project.id,
                title: `Health check failed: ${service.name}`,
                description: `${service.name} health endpoint ${service.path} is currently unhealthy.`,
                severity: 'High',
                service: service.service,
                actor: 'health-monitor',
            });
        });
    });
    res.json({ services });
});
exports.app.get('/api/monitoring/summary', (_req, res) => {
    res.json((0, metrics_1.requestHealthSummary)());
});
exports.app.get('/metrics', async (_req, res) => {
    if (process.env.CHECK_PROJECTS_ON_METRICS !== 'false') {
        await runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    }
    await syncGrafanaCloud('metrics.scrape');
    res.type('text/plain').send(await (0, metrics_1.renderMetrics)());
});
exports.app.get('/api/cron/push-metrics', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.header('authorization') !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: 'Unauthorized cron invocation' });
        return;
    }
    await runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    const result = await syncGrafanaCloud('vercel.cron', { force: true });
    res.json({ ok: true, result, at: new Date().toISOString() });
});
exports.app.get('/activity', (_req, res) => {
    res.json((0, activity_1.listActivity)());
});
exports.app.post('/activity', (req, res) => {
    const role = (0, rbac_1.getRole)(req);
    const log = (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'system',
        role,
        action: req.body?.action || 'activity.recorded',
    });
    realtime.broadcast({ type: 'activity', payload: log });
    res.json(log);
});
exports.app.get('/search', async (req, res) => {
    (0, analytics_1.bump)('searches');
    const query = String(req.query.q || '');
    const results = await (0, search_1.searchRecords)(query);
    res.json({ query, results });
});
exports.app.post('/uploads', (0, rbac_1.requireRole)(['admin', 'manager']), uploads_1.upload.single('file'), (req, res) => {
    (0, analytics_1.bump)('uploads');
    const file = req.file;
    const response = {
        filename: file?.filename,
        originalName: file?.originalname,
        size: file?.size,
    };
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'uploader',
        role: (0, rbac_1.getRole)(req),
        action: `upload:${file?.originalname ?? 'unknown'}`,
    });
    res.json(response);
});
exports.app.post('/jobs', (0, rbac_1.requireRole)(['admin']), (req, res) => {
    const job = {
        id: `${Date.now()}`,
        type: req.body?.type || 'sync.analytics',
        payload: req.body?.payload || {},
    };
    (0, jobs_1.enqueueJob)(job);
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'automation',
        role: (0, rbac_1.getRole)(req),
        action: `job.enqueued:${job.type}`,
    });
    res.json({ status: 'queued', job });
});
if (process.env.ENABLE_SERVICE_PROXY === 'true') {
    const serviceRoutes = {
        '/auth': { target: 'http://auth-service:3001', changeOrigin: true },
        '/projects': { target: 'http://project-service:3002', changeOrigin: true },
        '/notifications': { target: 'http://notification-service:3004', changeOrigin: true },
    };
    Object.keys(serviceRoutes).forEach(route => {
        exports.app.use(route, (0, http_proxy_middleware_1.createProxyMiddleware)(serviceRoutes[route]));
    });
}
if (!isServerless) {
    (0, jobs_1.startJobWorker)(realtime.broadcast);
    runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    setInterval(() => {
        runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    }, Number(process.env.PROJECT_HEALTH_CHECK_INTERVAL_MS || 30000));
    // Start the server
    server.listen(PORT, () => {
        console.log(`API Gateway is running on http://localhost:${PORT}`);
        // NOTE(git:perf/gateway): add connection pooling + keep-alive tuning
    });
}
exports.default = exports.app;
