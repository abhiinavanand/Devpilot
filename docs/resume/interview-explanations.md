# Interview Explanations

## Architecture Decisions
I chose a microservices architecture to isolate teams and scale independently. The API gateway provides consistent auth, rate limiting, and observability while service discovery keeps deployments flexible.

## DevOps Focus
I implemented IaC (Terraform + Helm), automated CI/CD, and observability with Prometheus, Grafana, and Loki, mirroring real production workflows.

## AI Focus
The AI assistant is designed for RAG workflows using vector search for project context retrieval, enabling safer and more relevant responses.
