# Service Discovery

The service discovery layer keeps services loosely coupled and enables dynamic scaling.

## Registry API
- `POST /services/register`
- `POST /services/heartbeat`
- `GET /services`

## Registration Flow
1. Service boots and registers with discovery.
2. Service sends heartbeat every 30 seconds.
3. API gateway uses registry for routing.
