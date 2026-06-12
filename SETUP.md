# DevPilot AI - Setup Guide

## Overview

DevPilot AI is a project management and deployment tracking platform with built-in monitoring integration. It combines Jira-like task management, deployment tracking, and observability through Prometheus and Grafana.

## Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- OR Node.js 20+ and npm

### Option 1: Docker (Recommended)

```bash
docker compose up
```

This will start:
- **Frontend**: http://localhost (port 80)
- **API Gateway**: http://localhost:3000
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

### Option 2: Local Development

Terminal 1 - API Gateway:
```bash
npm run dev:api
```
API will be available at http://localhost:3000

Terminal 2 - Frontend:
```bash
npm run dev
```
Frontend will be available at http://localhost:5173

Terminal 3 (optional) - Monitoring Stack:
```bash
npm run monitoring
```

## Authentication

Demo Account:
- **Email**: demo@devpilot.ai
- **Password**: password123

Authentication is localStorage-based. No backend setup required.

## Seed Database

To populate with sample data:
```bash
npm run seed
```

This creates sample projects, tasks, deployments, and incidents.

## Architecture

### Frontend
- React 18 with TypeScript
- Vite build tool
- Built-in component library (shadcn/ui inspired)
- Deployed as static nginx-served SPA

### API Gateway
- Express.js
- SQLite database (embedded)
- Real-time WebSocket support
- Prometheus metrics export

### Observability
- **Prometheus**: Scrapes metrics from `/metrics` endpoint
- **Grafana**: Visualizes Prometheus data
- Tracks: HTTP requests, projects, tasks, deployments, incidents

## Workflow

1. **Login** → Navigate to /login
2. **Dashboard** → Overview page shows workspace summary
3. **Projects** → Create and manage projects
4. **Project Detail** → Access 6 tabs per project:
   - **Overview**: Summary cards
   - **Tasks**: Task management with CRUD
   - **Kanban**: Drag-and-drop board
   - **Deployments**: Deployment history
   - **Incidents**: Incident tracking
   - **Monitoring**: Service health

## Database Schema

### Projects
- id, name, description, owner, status, createdAt, updatedAt

### Tasks
- id, projectId, title, description, type, status, priority, assignee, points, due, labels, createdAt, updatedAt
- Status: TODO, IN_PROGRESS, REVIEW, DONE
- Priority: Low, Medium, High, Critical

### Deployments
- id, projectId, service, environment, status, version, startedAt, durationMinutes
- Environment: staging, production
- Status: Queued, Running, Succeeded, Failed, Rolled Back

### Incidents
- id, projectId, title, description, severity, status, service, createdAt, resolvedAt

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id/summary` - Get project with tasks, deployments, incidents
- `PATCH /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Tasks
- `GET /api/projects/:projectId/tasks` - Get project tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Deployments
- `GET /api/deployments` - List all deployments
- `POST /api/deployments` - Create deployment

### Incidents
- `GET /api/incidents` - List all incidents
- `POST /api/incidents` - Create incident
- `PATCH /api/incidents/:id` - Update incident

### Monitoring
- `GET /health` - Health check
- `GET /api/service-health` - Service health status
- `GET /metrics` - Prometheus metrics
- `GET /api/dashboard` - Dashboard metrics
- `GET /api/analytics` - Analytics data

## Monitoring & Observability

### Prometheus Metrics

The API exposes Prometheus metrics at `/metrics`:
- `http_requests_total` - Total HTTP requests by method, route, status
- `http_request_duration_seconds` - Request latency histogram
- `projects_created_total` - Total projects created
- `tasks_created_total` - Total tasks created
- `active_projects_total` - Active projects gauge
- `deployments_created_total` - Total deployments created
- `incidents_created_total` - Total incidents created

### Grafana

Access Grafana at http://localhost:3001
- Default credentials: admin / admin
- Prometheus data source is pre-configured
- Use Monitoring page to access Grafana dashboards

## Development

### Project Structure
```
apps/
  api-gateway/       # Express backend
    src/
      index.ts       # Main server
      store.ts       # SQLite database
      metrics.ts     # Prometheus integration
  frontend/          # React SPA
    src/
      pages/         # Page components
      api/           # API client
      components/    # UI components
      layout/        # Layout components

packages/            # Shared code
monitoring/          # Prometheus & Grafana configs
docker-compose.yml   # Container orchestration
```

### Build
```bash
npm run build
```

### Test
```bash
npm run test
```

## Troubleshooting

### API Gateway Won't Start
- Check port 3000 is available: `lsof -i :3000`
- Check database file: `.data/store.db`

### Frontend Can't Connect to API
- Verify API is running at http://localhost:3000
- Check browser console for CORS errors
- Ensure `VITE_API_BASE_URL` is set correctly in docker-compose

### Prometheus Not Scraping Metrics
- Check `monitoring/prometheus/prometheus.yml` configuration
- Verify API is exposing `/metrics` endpoint
- Check Prometheus UI at http://localhost:9090/targets

### Docker Port Conflicts
- Change port mappings in `docker-compose.yml`
- Frontend: change `80:80` to `8080:80` (then access at http://localhost:8080)
- API: change `3000:3000` to `3001:3000` (then update frontend env vars)

## Key Design Decisions

1. **Project-Centric**: Everything revolves around projects
2. **Real Data Only**: No fake metrics or placeholders
3. **Database-Backed**: All metrics derived from actual records
4. **Prometheus Native**: Monitoring data sourced from Prometheus
5. **No Backend Auth**: localStorage-based for simplicity
6. **SPA Frontend**: Single Page App with client-side routing
7. **Embedded Database**: SQLite for zero-setup convenience

## Future Enhancements

- User roles and permissions (RBAC)
- Email notifications
- GitHub integration
- Kubernetes cluster management
- Custom dashboard creation
- Alert rules and notifications
- API rate limiting
- Request tracing with correlation IDs

## License

MIT
