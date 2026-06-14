"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestHealthSummary = exports.renderMetrics = exports.prometheusMiddleware = exports.observeIncidentCreated = exports.observeDeploymentCreated = exports.observeTaskCreated = exports.observeProjectCreated = void 0;
const store_1 = require("./store");
const requests = [];
const counters = {
    projectsCreated: 0,
    tasksCreated: 0,
    deploymentsCreated: 0,
    incidentsCreated: 0,
};
const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const routeLabel = (req) => req.route?.path ? String(req.route.path) : req.path;
const escapeLabel = (value) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
const observeProjectCreated = () => {
    counters.projectsCreated += 1;
};
exports.observeProjectCreated = observeProjectCreated;
const observeTaskCreated = () => {
    counters.tasksCreated += 1;
};
exports.observeTaskCreated = observeTaskCreated;
const observeDeploymentCreated = () => {
    counters.deploymentsCreated += 1;
};
exports.observeDeploymentCreated = observeDeploymentCreated;
const observeIncidentCreated = () => {
    counters.incidentsCreated += 1;
};
exports.observeIncidentCreated = observeIncidentCreated;
const prometheusMiddleware = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
        if (req.path === '/metrics')
            return;
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1000000000;
        requests.push({
            method: req.method,
            route: routeLabel(req),
            status: res.statusCode,
            durationSeconds,
        });
        if (requests.length > 5000) {
            requests.splice(0, requests.length - 5000);
        }
    });
    next();
};
exports.prometheusMiddleware = prometheusMiddleware;
const renderMetrics = async () => {
    const store = await (0, store_1.readStoreAsync)();
    const grouped = new Map();
    const healthChecksByProject = new Map();
    requests.forEach((request) => {
        const key = [request.method, request.route, request.status].join('|');
        grouped.set(key, [...(grouped.get(key) || []), request]);
    });
    store.projectHealthChecks.forEach((check) => {
        healthChecksByProject.set(check.projectId, [...(healthChecksByProject.get(check.projectId) || []), check]);
    });
    const lines = [
        '# HELP http_requests_total Total HTTP requests.',
        '# TYPE http_requests_total counter',
    ];
    grouped.forEach((items, key) => {
        const [method, route, status] = key.split('|');
        lines.push(`http_requests_total{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"} ${items.length}`);
    });
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds.', '# TYPE http_request_duration_seconds histogram');
    grouped.forEach((items, key) => {
        const [method, route, status] = key.split('|');
        let cumulative = 0;
        buckets.forEach((bucket) => {
            cumulative = items.filter((item) => item.durationSeconds <= bucket).length;
            lines.push(`http_request_duration_seconds_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}",le="${bucket}"} ${cumulative}`);
        });
        lines.push(`http_request_duration_seconds_bucket{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}",le="+Inf"} ${items.length}`);
        lines.push(`http_request_duration_seconds_sum{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"} ${items.reduce((sum, item) => sum + item.durationSeconds, 0).toFixed(6)}`);
        lines.push(`http_request_duration_seconds_count{method="${escapeLabel(method)}",route="${escapeLabel(route)}",status="${status}"} ${items.length}`);
    });
    lines.push('# HELP projects_created_total Total projects created through the API.', '# TYPE projects_created_total counter', `projects_created_total ${counters.projectsCreated}`, '# HELP tasks_created_total Total tasks created through the API.', '# TYPE tasks_created_total counter', `tasks_created_total ${counters.tasksCreated}`, '# HELP active_projects_total Active projects currently stored.', '# TYPE active_projects_total gauge', `active_projects_total ${store.projects.filter((project) => project.status === 'Active').length}`, '# HELP deployments_created_total Total deployments created through the API.', '# TYPE deployments_created_total counter', `deployments_created_total ${counters.deploymentsCreated}`, '# HELP incidents_created_total Total incidents created through the API.', '# TYPE incidents_created_total counter', `incidents_created_total ${counters.incidentsCreated}`);
    lines.push('# HELP project_health_status Current project health status, 1 healthy, 0.5 warning, 0 down.', '# TYPE project_health_status gauge', '# HELP project_response_time_ms Latest project app response time in milliseconds.', '# TYPE project_response_time_ms gauge', '# HELP project_http_status_code Latest project app HTTP status code.', '# TYPE project_http_status_code gauge', '# HELP project_uptime_percent Project app uptime percentage across recent health checks.', '# TYPE project_uptime_percent gauge', '# HELP project_health_checks_count Recent project health checks recorded by status.', '# TYPE project_health_checks_count gauge');
    store.projects.forEach((project) => {
        const checks = healthChecksByProject.get(project.id) || [];
        const latest = checks[0];
        if (!latest)
            return;
        const labels = `project_id="${escapeLabel(project.id)}",project_name="${escapeLabel(project.name)}",service="${escapeLabel(project.serviceName)}",app_url="${escapeLabel(project.appUrl)}"`;
        const healthyChecks = checks.filter((check) => check.status === 'healthy').length;
        const uptime = checks.length ? Number(((healthyChecks / checks.length) * 100).toFixed(2)) : 0;
        const healthValue = latest.status === 'healthy' ? 1 : latest.status === 'warning' ? 0.5 : 0;
        lines.push(`project_health_status{${labels},status="${latest.status}"} ${healthValue}`);
        lines.push(`project_response_time_ms{${labels}} ${latest.responseTimeMs}`);
        lines.push(`project_http_status_code{${labels}} ${latest.statusCode}`);
        lines.push(`project_uptime_percent{${labels}} ${uptime}`);
        ['healthy', 'warning', 'down'].forEach((status) => {
            lines.push(`project_health_checks_count{${labels},status="${status}"} ${checks.filter((check) => check.status === status).length}`);
        });
    });
    return `${lines.join('\n')}\n`;
};
exports.renderMetrics = renderMetrics;
const requestHealthSummary = () => {
    const recent = requests.slice(-200);
    const total = recent.length;
    const statusCodes = recent.reduce((counts, request) => {
        const code = String(request.status);
        counts[code] = (counts[code] || 0) + 1;
        return counts;
    }, {});
    const errorCount = recent.filter((request) => request.status >= 500).length;
    const warningCount = recent.filter((request) => request.status >= 400 && request.status < 500).length;
    const avgResponseTimeMs = total
        ? Math.round((recent.reduce((sum, request) => sum + request.durationSeconds, 0) / total) * 1000)
        : null;
    const uptimePercent = total ? Number((((total - errorCount) / total) * 100).toFixed(2)) : null;
    const status = errorCount > 0 ? 'Down' : warningCount > 0 || (avgResponseTimeMs !== null && avgResponseTimeMs > 1000) ? 'Warning' : 'Healthy';
    return {
        status,
        totalRequests: total,
        uptimePercent,
        avgResponseTimeMs,
        statusCodes,
        lastUpdatedAt: new Date().toISOString(),
    };
};
exports.requestHealthSummary = requestHealthSummary;
