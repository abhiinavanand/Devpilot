# Local Setup Guide

This guide covers running the full DevPilot AI stack locally with a production-grade workflow.

## Prerequisites
- Node.js 18+
- Docker Desktop (optional for infra services)
- Git

## Quickstart
1. Install dependencies per service:
   - `services/api-gateway`
   - `services/auth-service`
   - `services/project-service`
   - `services/analytics-service`
   - `services/notification-service`
   - `apps/frontend`

2. Start the API gateway:
   - `npm start` in `services/api-gateway`

3. Start the frontend console:
   - `npm run dev` in `apps/frontend`

4. Open the UI:
   - `http://127.0.0.1:5173`

## Environment Variables
Copy `.env.example` to `.env` and adjust as needed.

## Local Data
- Seed SQL lives in `data/seed`.
- Sample datasets are in `data/datasets`.

## Troubleshooting
- Verify ports: gateway `3000`, frontend `5173`.
- Check `docs/engineering/internal-notes.md` for local quirks.
