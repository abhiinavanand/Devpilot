# Architecture Overview

DevPilot is structured as a frontend plus a central API gateway, with project data and monitoring flowing through that gateway.

## Components

- `apps/frontend`
  React app for login, overview, projects, tasks, deployments, incidents, analytics, and monitoring
- `apps/api-gateway`
  Express API for project data, health checks, metrics, deployment webhooks, and Grafana Cloud publishing
- `monitoring/`
  Local Prometheus and Grafana configuration
- `packages/`
  Shared config, types, and utilities

## Runtime Flow

1. User signs in through the frontend demo auth flow
2. Frontend calls the API gateway with user identity headers
3. API gateway reads and writes project data
4. API gateway performs project app health checks
5. API gateway exposes Prometheus-style metrics and can publish them to Grafana Cloud
6. Grafana dashboards are opened from the project monitoring view

## Product Model

Everything revolves around projects:

- projects own tasks
- projects own deployments
- projects own incidents
- projects can map to an app URL and service name
- project monitoring is filtered by `project_id`
