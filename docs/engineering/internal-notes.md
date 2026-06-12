# Internal Developer Notes

## Local Setup
- Use `nvm` to pin Node 18+
- Run API gateway first, then microservices.

## Debugging Tips
- Gateway logs are in `services/api-gateway`.
- Enable verbose tracing with `LOG_LEVEL=debug`.

## Known Quirks
- Local mock data refresh may take ~30s.
