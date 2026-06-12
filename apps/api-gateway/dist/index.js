"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = require("body-parser");
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_proxy_middleware_1 = require("http-proxy-middleware");
const realtime_1 = require("./realtime");
const rbac_1 = require("./rbac");
const activity_1 = require("./activity");
const search_1 = require("./search");
const uploads_1 = require("./uploads");
const analytics_1 = require("./analytics");
const jobs_1 = require("./jobs");
const chatbot_1 = require("./chatbot");
const store_1 = require("./store");
const github_1 = require("./github");
const metrics_1 = require("./metrics");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const server = http_1.default.createServer(app);
const realtime = (0, realtime_1.createRealtimeServer)(server);
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
});
// Middleware
app.use((0, cors_1.default)());
app.use((0, body_parser_1.json)());
app.use(limiter);
app.use(metrics_1.prometheusMiddleware);
// TODO(gateway): introduce structured request logging with correlation IDs
// TECH-DEBT(gateway): move proxy route configuration to config service
app.use((req, _res, next) => {
    (0, analytics_1.bump)('requests');
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
    const store = (0, store_1.readStore)();
    const oneWeekAgo = Date.now() - 7 * 86400000;
    const completedTasks = store.tasks.filter((task) => task.status === 'DONE').length;
    const openIncidents = store.tasks.filter((task) => task.type === 'Incident' && task.status !== 'DONE').length;
    const openTrackedIncidents = store.incidents.filter((incident) => incident.status !== 'Resolved').length;
    const deploymentsThisWeek = store.deployments.filter((deployment) => new Date(deployment.startedAt).getTime() >= oneWeekAgo).length;
    res.json({
        metrics: [
            { label: 'Total Projects', value: String(store.projects.length), trend: `${store.projects.filter((project) => project.status === 'Active').length} active` },
            { label: 'Open Tasks', value: String(store.tasks.filter((task) => task.status !== 'DONE').length), trend: `${completedTasks} completed` },
            { label: 'Completed Tasks', value: String(completedTasks), trend: 'database records' },
            { label: 'Open Incidents', value: String(openTrackedIncidents + openIncidents), trend: 'project incidents' },
            { label: 'Deployments This Week', value: String(deploymentsThisWeek), trend: 'deployment records' },
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
    res.json((0, store_1.databaseInfo)());
});
app.get('/api/projects', (_req, res) => {
    const store = (0, store_1.readStore)();
    const projects = (0, store_1.listProjects)().map((project) => ({
        ...project,
        taskCount: store.tasks.filter((task) => task.projectId === project.id).length,
        openIncidents: store.incidents.filter((incident) => incident.projectId === project.id && incident.status !== 'Resolved').length,
    }));
    res.json({ projects });
});
app.post('/api/projects', (req, res) => {
    const project = (0, store_1.createProject)(req.body || {});
    (0, metrics_1.observeProjectCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `project.created:${project.name}`,
    });
    realtime.broadcast({ type: 'project.created', payload: project });
    res.status(201).json({ project });
});
app.patch('/api/projects/:id', (req, res) => {
    const project = (0, store_1.updateProject)(req.params.id, req.body || {});
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `project.updated:${project.name}`,
    });
    realtime.broadcast({ type: 'project.updated', payload: project });
    res.json({ project });
});
app.delete('/api/projects/:id', (req, res) => {
    const deleted = (0, store_1.deleteProject)(req.params.id);
    if (!deleted) {
        res.status(409).json({ error: 'Project still has tasks or does not exist' });
        return;
    }
    res.json({ ok: true });
});
app.get('/api/projects/:projectId/tasks', (req, res) => {
    const tasks = (0, store_1.readStore)().tasks.filter((task) => task.projectId === req.params.projectId);
    res.json({ tasks });
});
app.get('/api/projects/:projectId/summary', (req, res) => {
    const store = (0, store_1.readStore)();
    const project = store.projects.find((item) => item.id === req.params.projectId);
    if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    const tasks = store.tasks.filter((task) => task.projectId === project.id);
    const deployments = store.deployments.filter((deployment) => deployment.projectId === project.id);
    const incidents = store.incidents.filter((incident) => incident.projectId === project.id);
    res.json({ project, tasks, deployments, incidents });
});
app.get('/api/tasks', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const tasks = (0, store_1.readStore)().tasks.filter((task) => !projectId || task.projectId === projectId);
    res.json({ tasks });
});
app.post('/api/tasks', (req, res) => {
    const task = (0, store_1.createTask)(req.body || {});
    (0, metrics_1.observeTaskCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: `task.created:${task.title}`,
    });
    realtime.broadcast({ type: 'task.created', payload: task });
    res.status(201).json({ task });
});
app.patch('/api/tasks/:id', (req, res) => {
    const task = (0, store_1.updateTask)(req.params.id, req.body || {});
    if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
    }
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'product',
        role: (0, rbac_1.getRole)(req),
        action: req.body?.status ? `task.moved:${task.title}:${task.status}` : `task.updated:${task.title}`,
    });
    realtime.broadcast({ type: 'task.updated', payload: task });
    res.json({ task });
});
app.delete('/api/tasks/:id', (req, res) => {
    const deleted = (0, store_1.deleteTask)(req.params.id);
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
app.get('/api/deployments', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const deployments = (0, store_1.readStore)().deployments.filter((deployment) => !projectId || deployment.projectId === projectId);
    res.json({ deployments });
});
app.post('/api/deployments', (req, res) => {
    const deployment = (0, store_1.createDeployment)(req.body || {});
    (0, metrics_1.observeDeploymentCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'release',
        role: (0, rbac_1.getRole)(req),
        action: `deployment.created:${deployment.version}`,
    });
    realtime.broadcast({ type: 'deployment.created', payload: deployment });
    res.status(201).json({ deployment });
});
app.get('/api/slos', (_req, res) => {
    res.json({ slos: (0, store_1.readStore)().slos });
});
app.get('/api/github', (_req, res) => {
    res.json((0, github_1.githubSnapshot)());
});
app.post('/api/github/sync', async (req, res) => {
    const owner = String(req.body?.owner || req.query.owner || '').trim();
    const repo = String(req.body?.repo || req.query.repo || '').trim();
    if (!owner || !repo) {
        res.status(400).json({ error: 'owner and repo are required' });
        return;
    }
    try {
        const snapshot = await (0, github_1.syncGitHubRepository)(owner, repo);
        (0, activity_1.recordActivity)({
            actor: req.header('x-user') || 'github-sync',
            role: (0, rbac_1.getRole)(req),
            action: `github.synced:${owner}/${repo}`,
        });
        res.json(snapshot);
    }
    catch (error) {
        res.status(502).json({
            error: 'GitHub sync failed',
            detail: error instanceof Error ? error.message : 'Unknown error',
            snapshot: (0, github_1.githubSnapshot)(),
        });
    }
});
app.get('/api/kubernetes', (_req, res) => {
    const store = (0, store_1.readStore)();
    res.json({
        nodes: store.kubernetesNodes,
        pods: store.kubernetesPods,
        deployments: store.kubernetesDeployments,
    });
});
app.get('/api/dora', (_req, res) => {
    res.json((0, store_1.calculateDoraMetrics)());
});
app.get('/api/incidents/analysis', (_req, res) => {
    res.json((0, store_1.analyzeIncidents)());
});
app.get('/api/incidents', (req, res) => {
    const projectId = String(req.query.projectId || '');
    const incidents = (0, store_1.readStore)().incidents.filter((incident) => !projectId || incident.projectId === projectId);
    res.json({ incidents });
});
app.post('/api/incidents', (req, res) => {
    const incident = (0, store_1.createIncident)(req.body || {});
    (0, metrics_1.observeIncidentCreated)();
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'support',
        role: (0, rbac_1.getRole)(req),
        action: `incident.created:${incident.title}`,
    });
    realtime.broadcast({ type: 'incident.created', payload: incident });
    res.status(201).json({ incident });
});
app.patch('/api/incidents/:id', (req, res) => {
    const incident = (0, store_1.updateIncident)(req.params.id, req.body || {});
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
app.post('/api/tasks/reset', (_req, res) => {
    const store = (0, store_1.resetStore)();
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
    res.json({ services });
});
app.get('/metrics', (_req, res) => {
    res.type('text/plain').send((0, metrics_1.renderMetrics)());
});
app.get('/activity', (_req, res) => {
    res.json((0, activity_1.listActivity)());
});
app.post('/activity', (req, res) => {
    const role = (0, rbac_1.getRole)(req);
    const log = (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'system',
        role,
        action: req.body?.action || 'activity.recorded',
    });
    realtime.broadcast({ type: 'activity', payload: log });
    res.json(log);
});
app.get('/search', (req, res) => {
    (0, analytics_1.bump)('searches');
    const query = String(req.query.q || '');
    const results = (0, search_1.searchRecords)(query);
    res.json({ query, results });
});
app.post('/uploads', (0, rbac_1.requireRole)(['admin', 'manager']), uploads_1.upload.single('file'), (req, res) => {
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
app.post('/jobs', (0, rbac_1.requireRole)(['admin']), (req, res) => {
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
app.get('/analytics', (0, rbac_1.requireRole)(['admin', 'manager']), (_req, res) => {
    res.json({ snapshot: (0, analytics_1.snapshot)() });
});
app.get('/api/analytics', (_req, res) => {
    const store = (0, store_1.readStore)();
    const completedTasks = store.tasks.filter((task) => task.status === 'DONE').length;
    const pendingTasks = store.tasks.length - completedTasks;
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(Date.now() - (6 - index) * 86400000).toISOString().slice(0, 10);
        const dayStart = new Date(`${date}T00:00:00.000Z`).getTime();
        const dayEnd = dayStart + 86400000;
        return {
            date,
            projects: store.projects.filter((project) => new Date(project.createdAt).getTime() <= dayEnd).length,
            tasks: store.tasks.filter((task) => {
                const created = new Date(task.createdAt).getTime();
                return created >= dayStart && created < dayEnd;
            }).length,
            deployments: store.deployments.filter((deployment) => {
                const created = new Date(deployment.startedAt).getTime();
                return created >= dayStart && created < dayEnd;
            }).length,
            incidents: store.incidents.filter((incident) => {
                const created = new Date(incident.createdAt).getTime();
                return created >= dayStart && created < dayEnd;
            }).length,
        };
    });
    res.json({
        cards: {
            totalProjects: store.projects.length,
            activeProjects: store.projects.filter((project) => project.status === 'Active').length,
            openTasks: pendingTasks,
            completedTasks,
            deployments: store.deployments.length,
            incidents: store.incidents.length,
        },
        series: days,
    });
});
app.post('/ai/chat', (req, res) => {
    (0, analytics_1.bump)('chatMessages');
    const prompt = String(req.body?.prompt || '');
    const response = (0, chatbot_1.generateChatResponse)(prompt);
    (0, activity_1.recordActivity)({
        actor: req.header('x-user') || 'assistant',
        role: (0, rbac_1.getRole)(req),
        action: 'ai.chat',
    });
    res.json({ prompt, response });
});
if (process.env.ENABLE_SERVICE_PROXY === 'true') {
    const serviceRoutes = {
        '/auth': { target: 'http://auth-service:3001', changeOrigin: true },
        '/projects': { target: 'http://project-service:3002', changeOrigin: true },
        '/notifications': { target: 'http://notification-service:3004', changeOrigin: true },
    };
    Object.keys(serviceRoutes).forEach(route => {
        app.use(route, (0, http_proxy_middleware_1.createProxyMiddleware)(serviceRoutes[route]));
    });
}
(0, jobs_1.startJobWorker)(realtime.broadcast);
// Start the server
server.listen(PORT, () => {
    console.log(`API Gateway is running on http://localhost:${PORT}`);
    // NOTE(git:perf/gateway): add connection pooling + keep-alive tuning
});
