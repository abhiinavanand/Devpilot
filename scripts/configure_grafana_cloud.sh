#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_PATH="$ROOT_DIR/monitoring/prometheus/prometheus.grafana-cloud.yml.template"
OUTPUT_PATH="$ROOT_DIR/monitoring/prometheus/prometheus.grafana-cloud.generated.yml"

require_var() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: $name" >&2
    exit 1
  fi
}

require_var "GRAFANA_CLOUD_PROM_URL"
require_var "GRAFANA_CLOUD_PROM_USERNAME"
require_var "GRAFANA_CLOUD_API_TOKEN"

sed \
  -e "s|__GRAFANA_CLOUD_PROM_URL__|${GRAFANA_CLOUD_PROM_URL}|g" \
  -e "s|__GRAFANA_CLOUD_PROM_USERNAME__|${GRAFANA_CLOUD_PROM_USERNAME}|g" \
  -e "s|__GRAFANA_CLOUD_API_TOKEN__|${GRAFANA_CLOUD_API_TOKEN}|g" \
  "$TEMPLATE_PATH" > "$OUTPUT_PATH"

cat <<EOF
Generated Grafana Cloud Prometheus config:
  $OUTPUT_PATH

Next steps:
  1. Start Prometheus with the generated config:
     PROMETHEUS_CONFIG_FILE=./monitoring/prometheus/prometheus.grafana-cloud.generated.yml docker compose -f docker-compose.monitoring.yml up -d prometheus

  2. If you want DevPilot's Grafana button to open Grafana Cloud, set this in Vercel:
     VITE_OPEN_GRAFANA_URL=${GRAFANA_CLOUD_STACK_URL:-https://your-stack.grafana.net}

  3. Redeploy the Vercel frontend after updating that environment variable.
EOF
