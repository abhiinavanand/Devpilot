# Architecture Expansion

## New Microservices
- `service-discovery`: service registry + health checks
- `ai-rag-service`: retrieval-augmented AI assistant
- `audit-service`: immutable activity logs
- `search-service`: fast metadata indexing

## API Gateway
- Single entry point with RBAC, rate limits, and observability
- WebSocket gateway for real-time updates

## Service Discovery
- Registry exposes `/services` and `/heartbeat` endpoints
- Services register themselves at startup
