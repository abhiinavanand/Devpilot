# Enterprise Monitoring Stack

This stack uses Prometheus for metrics, Grafana for dashboards, and Loki for logs.

## Local Observability
- Compose file: `infra/observability/docker-compose.yml`
- Prometheus config: `infra/observability/prometheus/prometheus.yml`
- Loki config: `infra/observability/loki/config.yml`
- Grafana dashboards: `infra/observability/grafana/dashboards`

## Alerts
Alert rules live in `infra/observability/prometheus/alerts.yml`.

## Suggested Dashboards
- API Gateway latency
- Request volume by service
- Error budget burn
