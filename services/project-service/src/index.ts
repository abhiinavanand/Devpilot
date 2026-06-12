import express from 'express';

const app = express();
const PORT = process.env.PORT || 3002;
let requests = 0;

app.use(express.json());
app.use((_req, _res, next) => {
  requests += 1;
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'project-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', (_req, res) => {
  res.type('text/plain').send([
    '# HELP http_requests_total Total HTTP requests.',
    '# TYPE http_requests_total counter',
    `http_requests_total{service="project-service"} ${requests}`,
    '# HELP active_projects_total Active projects currently stored.',
    '# TYPE active_projects_total gauge',
    'active_projects_total 5',
  ].join('\n') + '\n');
});

app.listen(PORT, () => {
  console.log(`Project Service is running on port ${PORT}`);
});
