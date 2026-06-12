# API Reference

## Core Endpoints
- `GET /health`
- `GET /activity`
- `POST /activity`
- `GET /search?q=`
- `POST /ai/chat`
- `POST /uploads`
- `POST /jobs`
- `GET /analytics`

## Auth & RBAC
- Use `x-role` header: `admin | manager | viewer`
- Use `x-user` header for activity logs

## Realtime
- WebSocket: `ws://localhost:3000/realtime`
