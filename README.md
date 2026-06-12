# DevPilot AI

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.5-blue)
![Terraform](https://img.shields.io/badge/terraform-ready-844fba)

DevPilot AI is an AI-powered DevOps Project Management SaaS platform built like a startup MVP after six months of focused engineering by a five-person team. It combines a modern command-center UI, microservices, real-time systems, and infrastructure-as-code to simulate an enterprise-grade product ready for investor demos, recruiter reviews, and portfolio showcases.

> **Positioning:** DevPilot AI is designed to be resume-worthy for DevOps + AI roles, impressive on GitHub, and polished enough for demo videos and LinkedIn posts.

## Table of Contents

- [Features](#features)
- [Platform Highlights](#platform-highlights)
# DevPilot AI

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)
![TypeScript](https://img.shields.io/badge/typescript-5.5-blue)
![Terraform](https://img.shields.io/badge/terraform-ready-844fba)

DevPilot AI is an AI-powered DevOps Project Management SaaS platform built like a startup MVP after six months of focused engineering by a five-person team. It combines a modern command-center UI, microservices, real-time systems, and infrastructure-as-code to simulate an enterprise-grade product ready for investor demos, recruiter reviews, and portfolio showcases.

> **Positioning:** DevPilot AI is designed to be resume-worthy for DevOps + AI roles, impressive on GitHub, and polished enough for demo videos and LinkedIn posts.

## Table of Contents

- [Features](#features)
- [Platform Highlights](#platform-highlights)
- [Architecture](#architecture)
- [System Diagrams](#system-diagrams)
- [Repository Map](#repository-map)
- [Getting Started](#getting-started)
- [Local Setup](#local-setup)
- [Microservices](#microservices)
- [Observability](#observability)
- [AI & RAG](#ai--rag)
- [Data & Seeds](#data--seeds)
- [Deployment](#deployment)
- [Production Terraform](#production-terraform)
- [API Documentation](#api-documentation)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Version History](#version-history)
- [Engineering Notes](#engineering-notes)
- [GitHub Polish](#github-polish)
- [Resume & Interview](#resume--interview)
- [Contributing](#contributing)
- [License](#license)

## Features

- **User Authentication**: Secure user authentication and management through the Auth Service.
- **Project Management**: Create, update, and manage projects with the Project Service.
- **Analytics and Reporting**: Gain insights into project performance and team productivity with the Analytics Service.
- **Notifications**: Real-time notifications and alerts to keep teams informed.
- **API Gateway**: A unified entry point for all microservices, simplifying API management.
- **Realtime Hub**: WebSocket-based updates for activity, jobs, and metrics.
- **AI Assistant**: Interactive chatbot and retrieval-ready workflow foundation.

## Platform Highlights

- **Modular frontend kit** with 120+ UI components, API clients, and shared utilities.
- **Polished command center UI** inspired by Linear, Jira, Vercel, Datadog, GitHub, and Grafana.
- **Enterprise-ready CI/CD** workflows with staging/production scaffolds.
- **Infrastructure-as-code** via Helm charts and Terraform modules.
- **Observability suite** with dashboards, alerting, and SRE runbooks.
- **Data foundations** including seed scripts and realistic datasets.
- **Production safeguards** such as rate limiting, RBAC, caching, and background jobs.

## Architecture

DevPilot AI is structured around a microservices architecture with an API gateway, service discovery, and real-time event streams. Each service is independently deployable and can be scaled based on demand.

## System Diagrams

- System overview: `docs/architecture/diagrams/system.mmd`
- Data flow: `docs/architecture/diagrams/data-flow.mmd`
- Deployment topology: `docs/architecture/diagrams/deployment.mmd`

## Repository Map

- `apps/frontend`: UI shell, component library, API clients.
- `services/*`: Microservices (auth, project, analytics, notifications, gateway, service discovery, AI RAG).
- `libs/*`: Shared configuration, logging, utilities, and types.
- `infra/helm`: Helm charts and templates.
- `infra/terraform`: Terraform modules and environment overlays.
- `infra/observability`: Prometheus, Grafana, Loki, Promtail stack.
- `monitoring`: Dashboards, alerts, and SLOs.
- `docs`: Architecture, API specs, engineering playbooks, and portfolio assets.
- `data`: Seed scripts and enterprise datasets.

## Getting Started

1. **Clone the Repository**:
   ```
   git clone https://github.com/yourusername/devpilot-ai.git
   cd devpilot-ai
   ```

2. **Install Dependencies**:
   ```
   npm install
   ```

3. **Run the Application**:
   ```
   cd infra/docker
   docker-compose up
   ```

4. **Access the Application**:
   - API Gateway: `http://localhost:3000`
   - Frontend: `http://127.0.0.1:5173`

## Local Setup

- Local setup guide: `docs/local-setup.md`

## Microservices

### API Gateway
- **Location**: `services/api-gateway`
- **Entry Point**: `src/index.ts`

### Auth Service
- **Location**: `services/auth-service`
- **Entry Point**: `src/index.ts`

### Project Service
- **Location**: `services/project-service`
- **Entry Point**: `src/index.ts`

### Analytics Service
- **Location**: `services/analytics-service`
- **Entry Point**: `src/index.ts`

### Notification Service
- **Location**: `services/notification-service`
- **Entry Point**: `src/index.ts`

### Service Discovery
- **Location**: `services/service-discovery`
- **Entry Point**: `src/index.ts`

### AI RAG Service
- **Location**: `services/ai-rag-service`
- **Entry Point**: `app/main.py`

## Observability

- Dashboards live in `monitoring/dashboards`.
- Alerts live in `monitoring/alerts`.
- SLOs and runbooks are documented in `docs/engineering/sre`.
- Enterprise stack: `infra/observability` and `docs/monitoring/prometheus-grafana-loki.md`.

## AI & RAG

- RAG service: `services/ai-rag-service`
- Architecture docs: `docs/ai`

## Data & Seeds

- SQL seed scripts: `data/seed`.
- Enterprise sample datasets: `data/datasets`.

## Deployment

- **Docker**: Use the `docker-compose.yml` file for local development.
- **Kubernetes**: Use the `services.yaml` and `ingress.yaml` files for deploying to a Kubernetes cluster.
- **Deployment guide**: `docs/deployment/guide.md`

## Production Terraform

- Production stack: `infra/terraform/production`
- EKS guide: `docs/deployment/eks-production.md`

## API Documentation

- Overview: `docs/api/README.md`
- Reference: `docs/api/reference.md`
- Versioning: `docs/api/versioning.md`

## Documentation

- Architecture: `docs/architecture`
- API specs: `docs/api`
- Engineering: `docs/engineering`
- Monitoring: `docs/monitoring`

## Roadmap

- Product roadmap: `docs/roadmap.md`
- Sprint notes: `docs/sprints`

## Version History

- Changelog: `CHANGELOG.md`
- Release history: `docs/version-history.md`

## Engineering Notes

- Feature flags: `docs/engineering/feature-flags.md`
- Technical debt: `docs/engineering/tech-debt.md`
- Decision log: `docs/engineering/decisions.md`
- Commit style guide: `docs/engineering/commit-style.md`
- Microservice boundaries: `docs/architecture/microservice-boundaries.md`
- API versioning: `docs/api/versioning.md`
- Engineering handbook: `docs/engineering/handbook.md`
- Incident response: `docs/engineering/incident-response.md`
- Monitoring handbook: `docs/engineering/monitoring-handbook.md`

## GitHub Polish

- Badges & screenshots: `docs/github`

## Resume & Interview

- STAR bullets: `docs/resume/STAR-bullets.md`
- Interview explanations: `docs/resume/interview-explanations.md`

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with your changes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.