# Grafana Cloud Setup

DevPilot already exposes Prometheus metrics at:

- `https://devpilot-ai-blush.vercel.app/metrics`
- `http://localhost:3000/metrics` for local API development

To use Grafana Cloud as the global monitoring destination, keep Prometheus scraping DevPilot and forward samples to Grafana Cloud using `remote_write`.

According to Grafana Cloud's Prometheus documentation, you need the following values from the Prometheus card in the Grafana Cloud portal:

- the `/api/prom/push` remote write URL
- the metrics username
- a Cloud Access Policy token

Source:

- [Grafana Cloud Prometheus metrics docs](https://grafana.com/docs/grafana-cloud/send-data/metrics/metrics-prometheus/)

## 1. Export your Grafana Cloud values

```bash
export GRAFANA_CLOUD_STACK_URL="https://your-stack.grafana.net"
export GRAFANA_CLOUD_PROM_URL="https://prometheus-prod-XX-prod-<region>.grafana.net/api/prom/push"
export GRAFANA_CLOUD_PROM_USERNAME="1234567"
export GRAFANA_CLOUD_API_TOKEN="glc_..."
```

## 2. Generate a Prometheus config for Grafana Cloud

```bash
npm run monitoring:grafana-cloud
```

This writes:

```text
monitoring/prometheus/prometheus.grafana-cloud.generated.yml
```

## 3. Start Prometheus with the generated config

```bash
PROMETHEUS_CONFIG_FILE=./monitoring/prometheus/prometheus.grafana-cloud.generated.yml docker compose -f docker-compose.monitoring.yml up -d prometheus
```

You can also start the full local monitoring stack:

```bash
PROMETHEUS_CONFIG_FILE=./monitoring/prometheus/prometheus.grafana-cloud.generated.yml docker compose up -d api-gateway prometheus
```

## 4. Point the Vercel frontend at Grafana Cloud

Set this Vercel environment variable:

```bash
VITE_OPEN_GRAFANA_URL=https://your-stack.grafana.net
```

Then redeploy the Vercel project so the Monitoring tab opens Grafana Cloud instead of a local URL.

## 5. Import the DevPilot dashboard into Grafana Cloud

Import this bundled dashboard JSON into Grafana Cloud:

```text
monitoring/grafana/dashboards/project-observability.json
```

Keep the dashboard UID as:

```text
devpilot-project-observability
```

That UID is what DevPilot uses when building the project-specific Grafana link.

## 6. Open the project dashboard

DevPilot appends the project id as a Grafana dashboard variable when opening the project monitoring dashboard:

```text
/d/devpilot-project-observability/project-observability?var-project_id=<projectId>
```

That means the dashboard link works with Grafana Cloud as long as:

- the dashboard exists in your Grafana Cloud stack
- Prometheus data is being remote-written into that stack

## Notes

- Prometheus metrics are real DevPilot metrics; no fake monitoring values are generated.
- This setup makes Grafana globally accessible without depending on localhost or a tunnel.
- The Vercel deployment also supports direct Grafana Cloud publishing from the API gateway plus a production cron at `/api/cron/push-metrics`.
- On Vercel Hobby, cron runs once per day. User activity in DevPilot can still trigger additional Grafana Cloud pushes through the API.
