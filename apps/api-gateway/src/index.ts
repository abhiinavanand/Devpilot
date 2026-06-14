import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import http from 'http';
import https from 'https';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createRealtimeServer } from './realtime';
import { requireRole, getRole } from './rbac';
import { recordActivity, listActivity } from './activity';
import { searchRecords } from './search';
import { upload } from './uploads';
import { bump } from './analytics';
import { enqueueJob, startJobWorker } from './jobs';
import {
    createDeployment,
    createIncident,
    createProject,
    createTask,
    databaseInfo,
    deleteProject,
    deleteTask,
    findProjectByDeploymentWebhookToken,
    listIncidents,
    listIncidentsAsync,
    listProjectHealthChecks,
    listProjectHealthChecksAsync,
    listProjects,
    listProjectsAsync,
    recordProjectHealthCheck,
    readStore,
    readStoreAsync,
    resetStore,
    updateIncident,
    updateProject,
    updateTask
} from './store';
import type { Deployment } from './store';
import type { Project, ProjectHealthCheck } from './store';
import { observeDeploymentCreated, observeIncidentCreated, observeProjectCreated, observeTaskCreated, prometheusMiddleware, renderMetrics, requestHealthSummary } from './metrics';
import { pushMetricsToGrafanaCloud } from './grafanaCloud';

export const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const realtime = createRealtimeServer(server);
const isServerless = process.env.VERCEL === '1';

const requesterEmail = (req: express.Request) => String(req.header('x-user-email') || '').trim().toLowerCase();
const requesterName = (req: express.Request) => String(req.header('x-user') || '').trim();
const projectOwnedBy = (project: Project, email: string) => Boolean(email) && (project.ownerEmail || '').trim().toLowerCase() === email;
const requireRequesterEmail = (req: express.Request, res: express.Response) => {
    const email = requesterEmail(req);
    if (!email) {
        res.status(401).json({ error: 'Login required' });
        return undefined;
    }
    return email;
};
const ownedProjects = (projects: Project[], email: string) => projects.filter((project) => projectOwnedBy(project, email));

const normalizeDeploymentStatus = (status: unknown): Deployment['status'] => {
    const value = String(status || '').trim().toLowerCase();
    if (['success', 'succeeded', 'ready', 'completed', 'complete'].includes(value)) return 'Succeeded';
    if (['failed', 'failure', 'error', 'errored', 'cancelled', 'canceled'].includes(value)) return 'Failed';
    if (['running', 'in_progress', 'in-progress', 'building', 'deploying'].includes(value)) return 'Running';
    if (['rolled_back', 'rolled-back', 'rollback'].includes(value)) return 'Rolled Back';
    return 'Queued';
};

const normalizeDeploymentProvider = (provider: unknown): Deployment['provider'] => {
    const value = String(provider || '').trim().toLowerCase();
    const providers: Record<string, Deployment['provider']> = {
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

const deploymentProviderFromPlatform = (platform: string): Deployment['provider'] => {
    const value = String(platform || '').trim().toLowerCase();
    if (value === 'github-pages' || value === 'github') return 'GitHub Actions';
    if (value === 'vercel') return 'Vercel';
    if (value === 'railway') return 'Railway';
    if (value === 'render') return 'Render';
    return 'Other';
};

const normalizeDeploymentEnvironment = (environment: unknown): Deployment['environment'] =>
    String(environment || '').trim().toLowerCase() === 'production' ? 'production' : 'staging';

const normalizeDeploymentTimestamp = (value: unknown) => {
    if (!value) return new Date().toISOString();
    const numeric = Number(value);
    const parsed = Number.isFinite(numeric) ? new Date(numeric) : new Date(String(value));
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const classifyProjectHealth = (statusCode: number, responseTimeMs: number, error = '') => {
    if (error || statusCode >= 500 || statusCode === 0) return 'down';
    if (statusCode >= 400 || responseTimeMs > 1500) return 'warning';
    return 'healthy';
};

const checkProjectAppUrl = (projectId: string, appUrl: string) =>
    new Promise<{ statusCode: number; responseTimeMs: number; error: string }>((resolve) => {
        const startedAt = Date.now();
        let url: URL;
        try {
            url = new URL(appUrl);
        } catch {
            resolve({ statusCode: 0, responseTimeMs: 0, error: 'Invalid app URL' });
            return;
        }

        const client = url.protocol === 'https:' ? https : http;
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

const recordProjectHealthForProject = async (project: Project) => {
    const result = await checkProjectAppUrl(project.id, project.appUrl);
    const status = classifyProjectHealth(result.statusCode, result.responseTimeMs, result.error);
    const check = await recordProjectHealthCheck({
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

const ensureRecentProjectHealthCheck = async (project: Project, checks: ProjectHealthCheck[]) => {
    if (!project.appUrl || project.status !== 'Active') return undefined;
    const latest = checks.find((check) => check.projectId === project.id);
    if (latest && Date.now() - new Date(latest.checkedAt).getTime() < 25000) return latest;
    return recordProjectHealthForProject(project);
};

const runProjectHealthChecks = async () => {
    const projects = (await listProjectsAsync()).filter((project) => project.status === 'Active' && project.appUrl);
    await Promise.all(projects.map(recordProjectHealthForProject));
};

const syncGrafanaCloud = async (reason: string, options: { force?: boolean } = {}) => {
    try {
        return await pushMetricsToGrafanaCloud(reason, options);
    } catch (error) {
        console.error('Grafana Cloud push failed', reason, error);
        return { pushed: false, reason: 'push failed' };
    }
};

const deploymentFromWebhookPayload = (projectId: string, body: any): Partial<Deployment> => ({
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

const deploymentFromVercelPayload = (projectId: string, serviceName: string, body: any): Partial<Deployment> => {
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

const deploymentFromGitHubPayload = (projectId: string, serviceName: string, body: any): Partial<Deployment> => {
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

const deploymentFromGitHubPushPayload = (projectId: string, serviceName: string, body: any): Partial<Deployment> => {
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

const deploymentFromGitHubPageBuildPayload = (projectId: string, serviceName: string, body: any): Partial<Deployment> => {
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

const deploymentFromGitHubEvent = (projectId: string, serviceName: string, githubEvent: string, body: any): Partial<Deployment> | null => {
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

const recordIncidentIfMissing = async (input: {
    projectId: string;
    title: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    service: string;
    actor: string;
}) => {
    const alreadyOpen = (await listIncidentsAsync()).some((incident) =>
        incident.projectId === input.projectId &&
        incident.service === input.service &&
        incident.title === input.title &&
        incident.status !== 'Resolved'
    );
    if (alreadyOpen) return undefined;

    const incident = await createIncident({
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        severity: input.severity,
        status: 'Open',
        service: input.service,
        summary: input.description,
    });
    observeIncidentCreated();
    recordActivity({
        actor: input.actor,
        role: 'system',
        action: `incident.created:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.created', payload: incident });
    return incident;
};

const recordDeploymentFailureIncident = async (deployment: Deployment, actor: string) => {
    if (!['Failed', 'Rolled Back'].includes(deployment.status)) return;
    await recordIncidentIfMissing({
        projectId: deployment.projectId,
        title: `Deployment ${deployment.status}: ${deployment.version}`,
        description: `${deployment.provider} reported ${deployment.status.toLowerCase()} for ${deployment.service} ${deployment.version}.`,
        severity: deployment.status === 'Failed' ? 'High' : 'Medium',
        service: deployment.service,
        actor,
    });
};

const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(json());
app.use(limiter);
app.use(prometheusMiddleware);
// TODO(gateway): introduce structured request logging with correlation IDs
// TECH-DEBT(gateway): move proxy route configuration to config service

app.use((req, _res, next) => {
    bump('requests');
    next();
});

app.get('/', (_req, res) => {
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

app.get('/api/dashboard', async (_req, res) => {
    const email = requireRequesterEmail(_req, res);
    if (!email) return;
    const store = await readStoreAsync();
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
    const latestHealthByProject = new Map<string, ProjectHealthCheck>();
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

app.get('/api/database', (_req, res) => {
    res.json(databaseInfo());
});

app.get('/api/projects', async (_req, res) => {
    const email = requireRequesterEmail(_req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const projects = ownedProjects(store.projects, email).map((project) => ({
        ...project,
        taskCount: store.tasks.filter((task) => task.projectId === project.id).length,
        openTasks: store.tasks.filter((task) => task.projectId === project.id && task.status !== 'DONE').length,
        openIncidents: store.incidents.filter((incident) => incident.projectId === project.id && incident.status !== 'Resolved').length,
    }));
    res.json({ projects });
});

app.post('/api/projects', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const project = await createProject({ ...(req.body || {}), owner: req.body?.owner || requesterName(req) || 'Workspace Owner', ownerEmail: email });
    observeProjectCreated();
    recordActivity({
        actor: requesterName(req) || 'product',
        role: getRole(req),
        action: `project.created:${project.name}`,
    });
    await syncGrafanaCloud('project.created');
    realtime.broadcast({ type: 'project.created', payload: project });
    res.status(201).json({ project });
});

app.patch('/api/projects/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const current = (await listProjectsAsync()).find((item) => item.id === req.params.id);
    if (!current || !projectOwnedBy(current, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const project = await updateProject(req.params.id, req.body || {});
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'appUrl') && project.appUrl) {
        await recordProjectHealthForProject(project).catch((error) => console.error('Project health check failed', error));
    }
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `project.updated:${project.name}`,
    });
    await syncGrafanaCloud('project.updated');
    realtime.broadcast({ type: 'project.updated', payload: project });
    res.json({ project });
});

app.delete('/api/projects/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const current = (await listProjectsAsync()).find((item) => item.id === req.params.id);
    if (!current || !projectOwnedBy(current, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const deleted = await deleteProject(req.params.id);
    if (!deleted) {
        res.status(409).json({ error: 'Project still has tasks or does not exist' });
        return;
    }
    res.json({ ok: true });
});

app.get('/api/projects/:projectId/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === req.params.projectId);
    res.json({ tasks });
});

app.get('/api/projects/:projectId/summary', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === project.id);
    const deployments = store.deployments.filter((deployment) => deployment.projectId === project.id);
    const incidents = store.incidents.filter((incident) => incident.projectId === project.id);
    await ensureRecentProjectHealthCheck(project, store.projectHealthChecks).catch((error) => console.error('Project health check failed', error));
    const healthChecks = (await listProjectHealthChecksAsync(project.id)).slice(0, 50);
    await syncGrafanaCloud('project.summary');
    res.json({ project, tasks, deployments, incidents, healthChecks });
});

app.get('/api/projects/:projectId/health-checks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const project = (await listProjectsAsync()).find((item) => item.id === req.params.projectId);
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    res.json({ healthChecks: (await listProjectHealthChecksAsync(req.params.projectId)).slice(0, 50) });
});

app.get('/api/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const projectId = String(req.query.projectId || '');
    const store = await readStoreAsync();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const tasks = store.tasks.filter((task) => projectIds.has(task.projectId) && (!projectId || task.projectId === projectId));
    res.json({ tasks });
});

app.post('/api/tasks', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const project = (await listProjectsAsync()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const task = await createTask(req.body || {});
    observeTaskCreated();
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `task.created:${task.title}`,
    });
    await syncGrafanaCloud('task.created');
    realtime.broadcast({ type: 'task.created', payload: task });
    res.status(201).json({ task });
});

app.patch('/api/tasks/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const existing = store.tasks.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    const task = await updateTask(req.params.id, req.body || {});
    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: req.body?.status === 'DONE' ? `task.completed:${task.title}` : req.body?.status ? `task.updated:${task.title}` : `task.updated:${task.title}`,
    });
    await syncGrafanaCloud('task.updated');
    realtime.broadcast({ type: 'task.updated', payload: task });
    res.json({ task });
});

app.delete('/api/tasks/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const existing = store.tasks.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    const deleted = await deleteTask(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `task.deleted:${req.params.id}`,
    });
    realtime.broadcast({ type: 'task.deleted', payload: { id: req.params.id } });
    res.json({ ok: true });
});

app.get('/api/deployments', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const projectId = String(req.query.projectId || '');
    const store = await readStoreAsync();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const deployments = store.deployments.filter((deployment) => projectIds.has(deployment.projectId) && (!projectId || deployment.projectId === projectId));
    res.json({ deployments });
});

app.post('/api/deployments', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const project = (await listProjectsAsync()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const deployment = await createDeployment(req.body || {});
    observeDeploymentCreated();
    recordActivity({
        actor: req.header('x-user') || 'release',
        role: getRole(req),
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.created');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});

app.post('/api/projects/:projectId/deployments/webhook', async (req, res) => {
    const project = (await listProjectsAsync()).find((item) => item.id === req.params.projectId);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }

    const deployment = await createDeployment(deploymentFromWebhookPayload(project.id, req.body || {}));
    observeDeploymentCreated();
    recordActivity({
        actor: req.header('x-user') || deployment.triggeredBy || deployment.provider,
        role: getRole(req),
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.webhook');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});

const handleDeploymentWebhook = async (req: express.Request, res: express.Response) => {
    if (String(req.header('x-github-event') || '').toLowerCase() === 'ping') {
        res.json({ ok: true, message: 'DevPilot deployment webhook is reachable.' });
        return;
    }

    const project = await findProjectByDeploymentWebhookToken(req.params.token);
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
    const deployment = await createDeployment(deploymentInput);
    observeDeploymentCreated();
    recordActivity({
        actor: deployment.triggeredBy || deployment.provider,
        role: 'system',
        action: `deployment.added:${deployment.version}`,
    });
    await recordDeploymentFailureIncident(deployment, deployment.triggeredBy || deployment.provider);
    await syncGrafanaCloud('deployment.platform-webhook');
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
};

app.post('/webhooks/deployments/:token', handleDeploymentWebhook);
app.post('/webhooks/deployments/:platform/:token', handleDeploymentWebhook);

app.get('/api/slos', async (_req, res) => {
    res.json({ slos: (await readStoreAsync()).slos });
});

app.get('/api/incidents', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const projectId = String(req.query.projectId || '');
    const store = await readStoreAsync();
    const projectIds = new Set(ownedProjects(store.projects, email).map((project) => project.id));
    const incidents = store.incidents.filter((incident) => projectIds.has(incident.projectId) && (!projectId || incident.projectId === projectId));
    res.json({ incidents });
});

app.post('/api/incidents', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const project = (await listProjectsAsync()).find((item) => item.id === String(req.body?.projectId || ''));
    if (!project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const incident = await createIncident(req.body || {});
    observeIncidentCreated();
    recordActivity({
        actor: req.header('x-user') || 'support',
        role: getRole(req),
        action: `incident.created:${incident.title}`,
    });
    await syncGrafanaCloud('incident.created');
    realtime.broadcast({ type: 'incident.created', payload: incident });
    res.status(201).json({ incident });
});

app.patch('/api/incidents/:id', async (req, res) => {
    const email = requireRequesterEmail(req, res);
    if (!email) return;
    const store = await readStoreAsync();
    const existing = store.incidents.find((item) => item.id === req.params.id);
    const project = existing ? store.projects.find((item) => item.id === existing.projectId) : undefined;
    if (!existing || !project || !projectOwnedBy(project, email)) {
        res.status(404).json({ error: 'Incident not found' });
        return;
    }
    const incident = await updateIncident(req.params.id, req.body || {});
    if (!incident) {
        res.status(404).json({ error: 'Incident not found' });
        return;
    }
    recordActivity({
        actor: req.header('x-user') || 'support',
        role: getRole(req),
        action: `incident.updated:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.updated', payload: incident });
    res.json({ incident });
});

app.post('/api/tasks/reset', async (_req, res) => {
    const store = await resetStore();
    res.json({ tasks: store.tasks });
});

const healthPayload = (service: string) => ({
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

const checkUrl = (url: string) =>
    new Promise<boolean>((resolve) => {
        const request = http.get(url, (response) => {
            response.resume();
            resolve(response.statusCode ? response.statusCode >= 200 && response.statusCode < 300 : false);
        });
        request.setTimeout(1200, () => {
            request.destroy();
            resolve(false);
        });
        request.on('error', () => resolve(false));
    });

app.get('/health', (_req, res) => {
    res.json(healthPayload('api-gateway'));
});

app.get('/gateway/health', (_req, res) => {
    res.json(healthPayload('api-gateway'));
});

app.get('/auth/health', (_req, res) => {
    res.json(healthPayload('auth-service'));
});

app.get('/project/health', (_req, res) => {
    res.json(healthPayload('project-service'));
});

app.get('/analytics/health', (_req, res) => {
    res.json(healthPayload('analytics-service'));
});

app.get('/notification/health', (_req, res) => {
    res.json(healthPayload('notification-service'));
});

app.get('/api/service-health', async (_req, res) => {
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
    const projects = await listProjectsAsync();
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

app.get('/api/monitoring/summary', (_req, res) => {
    res.json(requestHealthSummary());
});

app.get('/metrics', async (_req, res) => {
    if (process.env.CHECK_PROJECTS_ON_METRICS !== 'false') {
        await runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    }
    await syncGrafanaCloud('metrics.scrape');
    res.type('text/plain').send(await renderMetrics());
});

app.get('/api/cron/push-metrics', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.header('authorization') !== `Bearer ${cronSecret}`) {
        res.status(401).json({ error: 'Unauthorized cron invocation' });
        return;
    }

    await runProjectHealthChecks().catch((error) => console.error('Project health check failed', error));
    const result = await syncGrafanaCloud('vercel.cron', { force: true });
    res.json({ ok: true, result, at: new Date().toISOString() });
});

app.get('/activity', (_req, res) => {
    res.json(listActivity());
});

app.post('/activity', (req, res) => {
    const role = getRole(req);
    const log = recordActivity({
        actor: req.header('x-user') || 'system',
        role,
        action: req.body?.action || 'activity.recorded',
    });
    realtime.broadcast({ type: 'activity', payload: log });
    res.json(log);
});

app.get('/search', async (req, res) => {
    bump('searches');
    const query = String(req.query.q || '');
    const results = await searchRecords(query);
    res.json({ query, results });
});

app.post('/uploads', requireRole(['admin', 'manager']), upload.single('file'), (req, res) => {
    bump('uploads');
            const file = (req as typeof req & { file?: Express.Multer.File }).file;
    const response = {
        filename: file?.filename,
        originalName: file?.originalname,
        size: file?.size,
    };
    recordActivity({
        actor: req.header('x-user') || 'uploader',
        role: getRole(req),
        action: `upload:${file?.originalname ?? 'unknown'}`,
    });
    res.json(response);
});

app.post('/jobs', requireRole(['admin']), (req, res) => {
    const job = {
        id: `${Date.now()}`,
        type: req.body?.type || 'sync.analytics',
        payload: req.body?.payload || {},
    };
    enqueueJob(job);
    recordActivity({
        actor: req.header('x-user') || 'automation',
        role: getRole(req),
        action: `job.enqueued:${job.type}`,
    });
    res.json({ status: 'queued', job });
});

if (process.env.ENABLE_SERVICE_PROXY === 'true') {
    const serviceRoutes = {
        '/auth': { target: 'http://auth-service:3001', changeOrigin: true },
        '/projects': { target: 'http://project-service:3002', changeOrigin: true },
        '/notifications': { target: 'http://notification-service:3004', changeOrigin: true },
    } as const;

    (Object.keys(serviceRoutes) as Array<keyof typeof serviceRoutes>).forEach(route => {
        app.use(route, createProxyMiddleware(serviceRoutes[route]));
    });
}

if (!isServerless) {
    startJobWorker(realtime.broadcast);
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

export default app;
