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
    listProjectHealthChecks,
    listProjects,
    recordProjectHealthCheck,
    readStore,
    resetStore,
    updateIncident,
    updateProject,
    updateTask
} from './store';
import type { Deployment } from './store';
import { observeDeploymentCreated, observeIncidentCreated, observeProjectCreated, observeTaskCreated, prometheusMiddleware, renderMetrics, requestHealthSummary } from './metrics';

export const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const realtime = createRealtimeServer(server);
const isServerless = process.env.VERCEL === '1';

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

const runProjectHealthChecks = async () => {
    const projects = listProjects().filter((project) => project.status === 'Active' && project.appUrl);
    await Promise.all(projects.map(async (project) => {
        const result = await checkProjectAppUrl(project.id, project.appUrl);
        const status = classifyProjectHealth(result.statusCode, result.responseTimeMs, result.error);
        const check = recordProjectHealthCheck({
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
    }));
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

const recordIncidentIfMissing = (input: {
    projectId: string;
    title: string;
    description: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    service: string;
    actor: string;
}) => {
    const alreadyOpen = listIncidents().some((incident) =>
        incident.projectId === input.projectId &&
        incident.service === input.service &&
        incident.title === input.title &&
        incident.status !== 'Resolved'
    );
    if (alreadyOpen) return undefined;

    const incident = createIncident({
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

const recordDeploymentFailureIncident = (deployment: Deployment, actor: string) => {
    if (!['Failed', 'Rolled Back'].includes(deployment.status)) return;
    recordIncidentIfMissing({
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

app.get('/api/dashboard', (_req, res) => {
    const store = readStore();
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const completedTasks = store.tasks.filter((task) => task.status === 'DONE').length;
    const openTrackedIncidents = store.incidents.filter((incident) => incident.status !== 'Resolved').length;
    const deploymentsThisWeek = store.deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= oneWeekAgo).length;

    res.json({
        metrics: [
            { label: 'Total Projects', value: String(store.projects.length) },
            { label: 'Open Tasks', value: String(store.tasks.filter((task) => task.status !== 'DONE').length) },
            { label: 'Completed Tasks', value: String(completedTasks) },
            { label: 'Open Incidents', value: String(openTrackedIncidents) },
            { label: 'Deployments This Week', value: String(deploymentsThisWeek) },
        ],
        timeline: store.deployments.map((deployment) => ({
            title: `${deployment.service} ${deployment.status}`,
            owner: deployment.environment,
            time: new Date(deployment.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })),
        deployments: store.deployments.slice(0, 5),
        incidents: store.incidents.filter((incident) => incident.status !== 'Resolved').slice(0, 5),
    });
});

app.get('/api/database', (_req, res) => {
    res.json(databaseInfo());
});

app.get('/api/projects', (_req, res) => {
    const store = readStore();
    const projects = listProjects().map((project) => ({
        ...project,
        taskCount: store.tasks.filter((task) => task.projectId === project.id).length,
        openTasks: store.tasks.filter((task) => task.projectId === project.id && task.status !== 'DONE').length,
        openIncidents: store.incidents.filter((incident) => incident.projectId === project.id && incident.status !== 'Resolved').length,
    }));
    res.json({ projects });
});

app.post('/api/projects', (req, res) => {
    const project = createProject(req.body || {});
    observeProjectCreated();
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `project.created:${project.name}`,
    });
    realtime.broadcast({ type: 'project.created', payload: project });
    res.status(201).json({ project });
});

app.patch('/api/projects/:id', (req, res) => {
    const project = updateProject(req.params.id, req.body || {});
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `project.updated:${project.name}`,
    });
    realtime.broadcast({ type: 'project.updated', payload: project });
    res.json({ project });
});

app.delete('/api/projects/:id', (req, res) => {
    const deleted = deleteProject(req.params.id);
    if (!deleted) {
        res.status(409).json({ error: 'Project still has tasks or does not exist' });
        return;
    }
    res.json({ ok: true });
});

app.get('/api/projects/:projectId/tasks', (req, res) => {
    const tasks = readStore().tasks.filter((task) => task.projectId === req.params.projectId);
    res.json({ tasks });
});

app.get('/api/projects/:projectId/summary', (req, res) => {
    const store = readStore();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === project.id);
    const deployments = store.deployments.filter((deployment) => deployment.projectId === project.id);
    const incidents = store.incidents.filter((incident) => incident.projectId === project.id);
    const healthChecks = store.projectHealthChecks.filter((check) => check.projectId === project.id).slice(0, 50);
    res.json({ project, tasks, deployments, incidents, healthChecks });
});

app.get('/api/projects/:projectId/health-checks', (req, res) => {
    res.json({ healthChecks: listProjectHealthChecks(req.params.projectId).slice(0, 50) });
});

app.get('/api/tasks', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const tasks = readStore().tasks.filter((task) => !projectId || task.projectId === projectId);
    res.json({ tasks });
});

app.post('/api/tasks', (req, res) => {
    const task = createTask(req.body || {});
    observeTaskCreated();
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: `task.created:${task.title}`,
    });
    realtime.broadcast({ type: 'task.created', payload: task });
    res.status(201).json({ task });
});

app.patch('/api/tasks/:id', (req, res) => {
    const task = updateTask(req.params.id, req.body || {});
    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    recordActivity({
        actor: req.header('x-user') || 'product',
        role: getRole(req),
        action: req.body?.status === 'DONE' ? `task.completed:${task.title}` : req.body?.status ? `task.updated:${task.title}` : `task.updated:${task.title}`,
    });
    realtime.broadcast({ type: 'task.updated', payload: task });
    res.json({ task });
});

app.delete('/api/tasks/:id', (req, res) => {
    const deleted = deleteTask(req.params.id);
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

app.get('/api/deployments', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const deployments = readStore().deployments.filter((deployment) => !projectId || deployment.projectId === projectId);
    res.json({ deployments });
});

app.post('/api/deployments', (req, res) => {
    const deployment = createDeployment(req.body || {});
    observeDeploymentCreated();
    recordActivity({
        actor: req.header('x-user') || 'release',
        role: getRole(req),
        action: `deployment.added:${deployment.version}`,
    });
    recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});

app.post('/api/projects/:projectId/deployments/webhook', (req, res) => {
    const project = listProjects().find((item) => item.id === req.params.projectId);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }

    const deployment = createDeployment(deploymentFromWebhookPayload(project.id, req.body || {}));
    observeDeploymentCreated();
    recordActivity({
        actor: req.header('x-user') || deployment.triggeredBy || deployment.provider,
        role: getRole(req),
        action: `deployment.added:${deployment.version}`,
    });
    recordDeploymentFailureIncident(deployment, req.header('x-user') || deployment.triggeredBy || deployment.provider);
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});

app.post('/webhooks/deployments/:token', (req, res) => {
    const project = findProjectByDeploymentWebhookToken(req.params.token);
    if (!project) {
        res.status(404).json({ error: 'Deployment webhook not found' });
        return;
    }

    const provider = normalizeDeploymentProvider(req.body?.provider || req.body?.source || req.body?.type?.split('.')?.[0]);
    const deploymentInput = provider === 'Vercel' || String(req.body?.type || '').toLowerCase().startsWith('deployment.')
        ? deploymentFromVercelPayload(project.id, project.serviceName, req.body || {})
        : {
            ...deploymentFromWebhookPayload(project.id, req.body || {}),
            service: req.body?.service || req.body?.serviceName || project.serviceName || 'application-service',
        };
    const deployment = createDeployment(deploymentInput);
    observeDeploymentCreated();
    recordActivity({
        actor: deployment.triggeredBy || deployment.provider,
        role: 'system',
        action: `deployment.added:${deployment.version}`,
    });
    recordDeploymentFailureIncident(deployment, deployment.triggeredBy || deployment.provider);
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});

app.get('/api/slos', (_req, res) => {
    res.json({ slos: readStore().slos });
});

app.get('/api/incidents', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const incidents = readStore().incidents.filter((incident) => !projectId || incident.projectId === projectId);
    res.json({ incidents });
});

app.post('/api/incidents', (req, res) => {
    const incident = createIncident(req.body || {});
    observeIncidentCreated();
    recordActivity({
        actor: req.header('x-user') || 'support',
        role: getRole(req),
        action: `incident.created:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.created', payload: incident });
    res.status(201).json({ incident });
});

app.patch('/api/incidents/:id', (req, res) => {
    const incident = updateIncident(req.params.id, req.body || {});
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

app.post('/api/tasks/reset', (_req, res) => {
    const store = resetStore();
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
    const projects = listProjects();
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
    res.type('text/plain').send(renderMetrics());
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

app.get('/search', (req, res) => {
    bump('searches');
    const query = String(req.query.q || '');
    const results = searchRecords(query);
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
