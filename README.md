# DevPilot AI

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.5-blue)
![Docker](https://img.shields.io/badge/docker-ready-blue)

DevPilot AI is a clean, project-centric platform for engineering teams to manage projects, track deployments, and monitor service health. Built with React, Express, and Docker, it combines task management, deployment tracking, and observability in one place.

## Features

- **Project Management**: Create projects, assign ownership, track status
- **Task Management**: Full CRUD with Kanban boards, priorities, and assignments
- **Deployment Tracking**: Track deployments across environments with status and version control
- **Incident Management**: Create, investigate, and resolve incidents
- **Service Monitoring**: Real-time health checks and integration with Grafana
- **Analytics**: Track projects, tasks, deployments, and incidents over time
- **Prometheus Metrics**: Built-in metrics export for observability

## Quick Start

### With Docker (Recommended)

```bash
docker compose up
```

Visit http://localhost

### Local Development

```bash
npm run dev:api      # Terminal 1: API on localhost:3000
npm run dev          # Terminal 2: Frontend on localhost:5173
npm run monitoring   # Terminal 3 (optional): Prometheus & Grafana
```

## Login

Demo Account:
- Email: `demo@devpilot.ai`
- Password: `password123`

## Project Workflow

1. **Overview** - Workspace dashboard with real metrics
2. **Projects** - Create and manage projects
3. **Project Detail** - Access all project features:
   - Overview: Summary cards
   - Tasks: Task CRUD + assignment
   - Kanban: Drag-and-drop board
   - Deployments: Release tracking
   - Incidents: Issue management
   - Monitoring: Service health

## Architecture

```
Frontend (React + Vite)
    ↓
API Gateway (Express + SQLite)
    ↓
Prometheus (Metrics Collection)
    ↓
Grafana (Observability)
```

- **Frontend**: React SPA with TypeScript, Tailwind CSS
- **API**: Express.js with embedded SQLite database
- **Monitoring**: Prometheus + Grafana stack
- **Containerization**: Docker Compose for one-command startup

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id/summary` - Get project details

### Tasks
- `POST /api/tasks` - Create task
- `PATCH /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Deployments
- `POST /api/deployments` - Record deployment

### Incidents
- `POST /api/incidents` - Create incident
- `PATCH /api/incidents/:id` - Update incident

### Monitoring
- `GET /metrics` - Prometheus metrics
- `GET /api/service-health` - Service status

## Database

- **Type**: SQLite (embedded)
- **Seeding**: `npm run seed` to populate sample data
- **Location**: `.data/store.db`

Data includes: Projects, Tasks, Deployments, Incidents

## Monitoring

### Prometheus
- URL: http://localhost:9090
- Scrapes `/metrics` endpoint every 10 seconds

### Grafana
- URL: http://localhost:3001
- Credentials: admin / admin
- Metrics source: Prometheus

## Documentation

- [Setup Guide](./SETUP.md) - Detailed setup and troubleshooting
- [Contributing](./CONTRIBUTING.md) - Development guidelines
- [License](./LICENSE) - MIT

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Vite
- **Backend**: Node.js, Express.js, SQLite
- **Observability**: Prometheus, Grafana
- **DevOps**: Docker, Docker Compose

## Key Design Decisions

- **Project-centric**: All features organized around projects
- **Real data only**: No fake metrics or placeholders
- **Database-backed**: Metrics derived from actual records
- **Simple auth**: localStorage-based (no backend setup)
- **Single Page App**: Client-side routing
- **Embedded DB**: Zero external dependencies
- **Observable**: Native Prometheus integration

## Getting Help

Check [SETUP.md](./SETUP.md) for troubleshooting and detailed documentation.

## License

MIT - See [LICENSE](./LICENSE)
