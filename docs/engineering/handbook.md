# Engineering Handbook

## Principles
- Ship small, ship often.
- Automate everything that repeats.
- Build for observability.
- Default to secure-by-design.

## SDLC
1. Plan in roadmap + sprint docs.
2. Implement with feature flags.
3. Test + review in CI.
4. Roll out via canary.

## Coding Standards
- TypeScript-first.
- Prefer shared libs under `libs/`.
- Use ADRs for major decisions.

## Release Process
- Release train: weekly.
- Always include a rollback plan.
- Post-deploy review is required.
