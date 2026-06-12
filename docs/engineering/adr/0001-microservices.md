# ADR 0001: Microservices Architecture

## Status
Accepted

## Context
The platform needs independent scaling, fault isolation, and rapid iteration across multiple domains.

## Decision
Adopt a microservices architecture with an API gateway as the single external entry point.

## Consequences
- Services can scale independently.
- Increased operational complexity.
- Requires stronger observability and CI/CD automation.
