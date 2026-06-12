import express from 'express';
import { json } from 'body-parser';
import cors from 'cors';
import http from 'http';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createRealtimeServer } from './realtime';
import { requireRole, getRole } from './rbac';
import { recordActivity, listActivity } from './activity';
import { searchRecords } from './search';
import { upload } from './uploads';
import { bump, snapshot } from './analytics';
import { enqueueJob, startJobWorker } from './jobs';
import { generateChatResponse } from './chatbot';
import {
    analyzeIncidents,
    calculateDoraMetrics,
    createProject,
    createTask,
    databaseInfo,
    deleteProject,
    deleteTask,
    listProjects,
    readStore,
    resetStore,
    updateProject,
    updateTask
} from './store';
import { githubSnapshot, syncGitHubRepository } from './github';
import { observeProjectCreated, observeTaskCreated, prometheusMiddleware, renderMetrics } from './metrics';

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const realtime = createRealtimeServer(server);

const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
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
            '/api/database',
            '/api/github',
            '/api/kubernetes',
            '/api/dora',
            '/api/incidents/analysis',
            '/activity',
            '/search',
            '/analytics',
            '/uploads',
            '/jobs',
            '/ai/chat'
        ]
    });
});

app.get('/api/dashboard', (_req, res) => {
    const store = readStore();
    const dora = calculateDoraMetrics();
    const incidentAnalysis = analyzeIncidents();
    const completedPoints = store.tasks
        .filter((task) => task.status === 'DONE')
        .reduce((total, task) => total + task.points, 0);
    const openIncidents = store.tasks.filter((task) => task.type === 'Incident' && task.status !== 'DONE').length;
    const successfulDeployments = store.deployments.filter((deployment) => deployment.status === 'Succeeded').length;
    const deploymentRate = store.deployments.length
        ? Math.round((successfulDeployments / store.deployments.length) * 100)
        : 0;
    const averageBudget = store.slos.length
        ? Math.round(store.slos.reduce((total, slo) => total + slo.errorBudgetRemaining, 0) / store.slos.length)
        : 0;

    res.json({
        metrics: [
            { label: 'Active Projects', value: String(store.projects.filter((project) => project.status === 'Active').length), trend: `${store.projects.length} total` },
            { label: 'Active Work', value: String(store.tasks.filter((task) => task.status !== 'DONE').length), trend: `${completedPoints} pts done` },
            { label: 'Deployment Success', value: `${deploymentRate}%`, trend: `${successfulDeployments}/${store.deployments.length} green` },
            { label: 'Open Incidents', value: String(openIncidents), trend: openIncidents ? 'Needs triage' : 'Clear' },
            { label: 'Error Budget', value: `${averageBudget}%`, trend: 'avg remaining' },
            { label: 'DORA Lead Time', value: `${dora.leadTimeHours}h`, trend: `${dora.deploymentFrequency}/day deploys` },
            { label: 'AI Risk Score', value: `${incidentAnalysis.riskScore}/100`, trend: incidentAnalysis.riskScore >= 70 ? 'High risk' : 'Managed' },
        ],
        deploymentSeries: store.deployments.map((deployment) => ({
            name: deployment.service.replace('-service', ''),
            success: deployment.status === 'Succeeded' ? deployment.successRate : Math.max(0, deployment.successRate - 20),
            failed: deployment.status === 'Succeeded' ? 100 - deployment.successRate : 100 - Math.max(0, deployment.successRate - 20),
        })),
        latencySeries: store.slos.map((slo) => ({
            time: slo.service.replace('-service', ''),
            p95: Math.round((100 - slo.current) * 100),
            p99: Math.round((100 - slo.current) * 140),
        })),
        timeline: store.deployments.map((deployment) => ({
            title: `${deployment.service} ${deployment.status}`,
            owner: deployment.environment,
            time: new Date(deployment.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        })),
        dora,
        incidentAnalysis,
        githubSummary: {
            repositories: store.githubRepositories.length,
            commits: store.githubCommits.length,
            pullRequests: store.githubPullRequests.length,
            latestCommit: store.githubCommits[0],
        },
        kubernetesSummary: {
            nodes: store.kubernetesNodes.length,
            pods: store.kubernetesPods.length,
            unhealthyPods: store.kubernetesPods.filter((pod) => pod.status !== 'Running' || pod.restarts >= 5).length,
            deployments: store.kubernetesDeployments.length,
        },
    });
});

app.get('/api/database', (_req, res) => {
    res.json(databaseInfo());
});

app.get('/api/projects', (_req, res) => {
    res.json({ projects: listProjects() });
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
        action: req.body?.status ? `task.moved:${task.title}:${task.status}` : `task.updated:${task.title}`,
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

app.get('/api/deployments', (_req, res) => {
    res.json({ deployments: readStore().deployments });
});

app.get('/api/slos', (_req, res) => {
    res.json({ slos: readStore().slos });
});

app.get('/api/github', (_req, res) => {
    res.json(githubSnapshot());
});

app.post('/api/github/sync', async (req, res) => {
    const owner = String(req.body?.owner || req.query.owner || '').trim();
    const repo = String(req.body?.repo || req.query.repo || '').trim();
    if (!owner || !repo) {
        res.status(400).json({ error: 'owner and repo are required' });
        return;
    }

    try {
        const snapshot = await syncGitHubRepository(owner, repo);
        recordActivity({
            actor: req.header('x-user') || 'github-sync',
            role: getRole(req),
            action: `github.synced:${owner}/${repo}`,
        });
        res.json(snapshot);
    } catch (error) {
        res.status(502).json({
            error: 'GitHub sync failed',
            detail: error instanceof Error ? error.message : 'Unknown error',
            snapshot: githubSnapshot(),
        });
    }
});

app.get('/api/kubernetes', (_req, res) => {
    const store = readStore();
    res.json({
        nodes: store.kubernetesNodes,
        pods: store.kubernetesPods,
        deployments: store.kubernetesDeployments,
    });
});

app.get('/api/dora', (_req, res) => {
    res.json(calculateDoraMetrics());
});

app.get('/api/incidents/analysis', (_req, res) => {
    res.json(analyzeIncidents());
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

app.get('/api/service-health', (_req, res) => {
    res.json({
        services: [
            { name: 'API Gateway', path: '/gateway/health', ...healthPayload('api-gateway') },
            { name: 'Auth Service', path: '/auth/health', ...healthPayload('auth-service') },
            { name: 'Project Service', path: '/project/health', ...healthPayload('project-service') },
            { name: 'Analytics Service', path: '/analytics/health', ...healthPayload('analytics-service') },
            { name: 'Notification Service', path: '/notification/health', ...healthPayload('notification-service') },
        ],
    });
});

app.get('/metrics', (_req, res) => {
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

app.get('/analytics', requireRole(['admin', 'manager']), (_req, res) => {
    res.json({ snapshot: snapshot() });
});

app.get('/api/analytics', (_req, res) => {
    const store = readStore();
    const counters = snapshot();
    const completedTasks = store.tasks.filter((task) => task.status === 'DONE').length;
    const pendingTasks = store.tasks.length - completedTasks;
    const errorRate = store.deployments.length
        ? Number(((store.deployments.filter((deployment) => ['Failed', 'Rolled Back'].includes(deployment.status)).length / store.deployments.length) * 100).toFixed(1))
        : 0;
    const avgResponseTime = store.slos.length
        ? Math.round(store.slos.reduce((total, slo) => total + ((100 - slo.current) * 30), 0) / store.slos.length)
        : 120;

    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10);
        return {
            date,
            projects: Math.max(1, Math.round(store.projects.length * ((index + 1) / 7))),
            tasks: store.tasks.filter((_, taskIndex) => taskIndex % 7 === index).length,
            requests: counters.requests + 20 + index * 8,
            latency: avgResponseTime + (index % 3) * 18,
        };
    });

    res.json({
        cards: {
            totalProjects: store.projects.length,
            activeProjects: store.projects.filter((project) => project.status === 'Active').length,
            completedTasks,
            pendingTasks,
            errorRate,
            avgResponseTime,
        },
        series: days,
    });
});

app.post('/ai/chat', (req, res) => {
    bump('chatMessages');
    const prompt = String(req.body?.prompt || '');
    const response = generateChatResponse(prompt);
    recordActivity({
        actor: req.header('x-user') || 'assistant',
        role: getRole(req),
        action: 'ai.chat',
    });
    res.json({ prompt, response });
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

startJobWorker(realtime.broadcast);

// Start the server
server.listen(PORT, () => {
    console.log(`API Gateway is running on http://localhost:${PORT}`);
    // NOTE(git:perf/gateway): add connection pooling + keep-alive tuning
});
