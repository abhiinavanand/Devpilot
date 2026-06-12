# Architecture Overview

DevPilot AI uses a microservices architecture with a centralized API gateway.

## Key Components
- API Gateway
- Auth Service
- Project Service
- Analytics Service
- Notification Service

## Data Flow
Requests enter via the gateway and are routed to service-specific handlers.
