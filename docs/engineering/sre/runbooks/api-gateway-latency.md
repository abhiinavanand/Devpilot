# Runbook: API Gateway Latency

## Symptoms
- P95 latency > 350ms
- Elevated 5xx responses

## Immediate Actions
1. Check dashboard panels for spikes.
2. Validate upstream service health.
3. Scale gateway replicas if needed.

## Escalation
- Notify on-call platform engineer.
