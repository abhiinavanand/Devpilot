import express from 'express';

const app = express();
const PORT = process.env.PORT || 3003;
let requests = 0;

app.use(express.json());
app.use((_req, _res, next) => {
  requests += 1;
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'analytics-service', timestamp: new Date().toISOString() });
});

app.get('/report', (_req, res) => {
  res.json({ activeProjects: 5, activeUsers: 6, errorRate: 2.4, avgResponseTime: 142 });
});

app.get('/metrics', (_req, res) => {
  res.type('text/plain').send([
    '# HELP http_requests_total Total HTTP requests.',
    '# TYPE http_requests_total counter',
    `http_requests_total{service="analytics-service"} ${requests}`,
    '# HELP active_users_total Demo active users.',
    '# TYPE active_users_total gauge',
    'active_users_total 6',
  ].join('\n') + '\n');
});

app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});
