# DevPilot API

DevPilot uses a single API gateway for the product experience.

## Core Endpoints

### Projects

- `GET /api/projects`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:projectId/summary`
- `GET /api/projects/:projectId/tasks`
- `GET /api/projects/:projectId/health-checks`

### Tasks

- `GET /api/tasks`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Deployments

- `GET /api/deployments`
- `POST /api/deployments`
- `POST /api/projects/:projectId/deployments/webhook`
- `POST /webhooks/deployments/:platform/:token`

### Incidents

- `GET /api/incidents`
- `POST /api/incidents`
- `PATCH /api/incidents/:id`

### Monitoring

- `GET /metrics`
- `GET /api/service-health`
- `GET /api/monitoring/summary`
- `GET /health`
- `GET /gateway/health`
- `GET /auth/health`
- `GET /project/health`
- `GET /analytics/health`
- `GET /notification/health`

### Utility

- `GET /activity`
- `POST /activity`
- `GET /search?q=...`

## Auth Model

This demo uses browser-local authentication in the frontend. API requests carry:

- `x-user`
- `x-user-email`

Project data is scoped by `ownerEmail`.
