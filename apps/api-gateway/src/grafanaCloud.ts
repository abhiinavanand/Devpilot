import axios from 'axios';
import protobuf from 'protobufjs';
import snappy from 'snappyjs';
import { readStoreAsync } from './store';

type Label = { name: string; value: string };
type Sample = { value: number; timestamp: number };
type TimeSeries = { labels: Label[]; samples: Sample[] };

const root = protobuf.Root.fromJSON({
  nested: {
    prometheus: {
      nested: {
        WriteRequest: {
          fields: {
            timeseries: { rule: 'repeated', type: 'TimeSeries', id: 1 },
          },
        },
        TimeSeries: {
          fields: {
            labels: { rule: 'repeated', type: 'Label', id: 1 },
            samples: { rule: 'repeated', type: 'Sample', id: 2 },
          },
        },
        Label: {
          fields: {
            name: { type: 'string', id: 1 },
            value: { type: 'string', id: 2 },
          },
        },
        Sample: {
          fields: {
            value: { type: 'double', id: 1 },
            timestamp: { type: 'int64', id: 2 },
          },
        },
      },
    },
  },
});

const WriteRequest = root.lookupType('prometheus.WriteRequest');
let lastPushAt = 0;

const escape = (value: string) => String(value || '');

const series = (name: string, value: number, timestamp: number, labels: Record<string, string> = {}): TimeSeries => ({
  labels: [
    { name: '__name__', value: name },
    ...Object.entries(labels)
      .filter(([, labelValue]) => labelValue !== undefined && labelValue !== null && labelValue !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([labelName, labelValue]) => ({ name: labelName, value: escape(labelValue) })),
  ],
  samples: [{ value, timestamp }],
});

const collectSeries = async (timestamp: number) => {
  const store = await readStoreAsync();
  const healthChecksByProject = new Map<string, typeof store.projectHealthChecks>();

  store.projectHealthChecks.forEach((check) => {
    healthChecksByProject.set(check.projectId, [...(healthChecksByProject.get(check.projectId) || []), check]);
  });

  const lines: TimeSeries[] = [
    series('projects_created_total', store.projects.length, timestamp),
    series('tasks_created_total', store.tasks.length, timestamp),
    series('deployments_created_total', store.deployments.length, timestamp),
    series('incidents_created_total', store.incidents.length, timestamp),
    series('active_projects_total', store.projects.filter((project) => project.status === 'Active').length, timestamp),
  ];

  store.projects.forEach((project) => {
    const checks = healthChecksByProject.get(project.id) || [];
    const latest = checks[0];
    if (!latest) return;

    const healthyChecks = checks.filter((check) => check.status === 'healthy').length;
    const uptime = checks.length ? Number(((healthyChecks / checks.length) * 100).toFixed(2)) : 0;
    const labels = {
      project_id: project.id,
      project_name: project.name,
      service: project.serviceName,
      app_url: project.appUrl,
    };
    const healthValue = latest.status === 'healthy' ? 1 : latest.status === 'warning' ? 0.5 : 0;

    lines.push(series('project_health_status', healthValue, timestamp, { ...labels, status: latest.status }));
    lines.push(series('project_response_time_ms', latest.responseTimeMs, timestamp, labels));
    lines.push(series('project_http_status_code', latest.statusCode, timestamp, labels));
    lines.push(series('project_uptime_percent', uptime, timestamp, labels));

    ['healthy', 'warning', 'down'].forEach((status) => {
      lines.push(series('project_health_checks_count', checks.filter((check) => check.status === status).length, timestamp, { ...labels, status }));
    });
  });

  return lines;
};

export const pushMetricsToGrafanaCloud = async (reason: string, options: { force?: boolean } = {}) => {
  const url = process.env.GRAFANA_CLOUD_PROM_URL;
  const username = process.env.GRAFANA_CLOUD_PROM_USERNAME;
  const password = process.env.GRAFANA_CLOUD_API_TOKEN;

  if (!url || !username || !password) {
    return { pushed: false, reason: 'Grafana Cloud credentials are not configured.' };
  }

  const now = Date.now();
  if (!options.force && now - lastPushAt < 60_000) {
    return { pushed: false, reason: `Skipped duplicate push for ${reason}.` };
  }

  const timeseries = await collectSeries(now);
  const payload = WriteRequest.encode({ timeseries }).finish();
  const compressed = Buffer.from(snappy.compress(payload));

  await axios.post(url, compressed, {
    auth: { username, password },
    headers: {
      'Content-Type': 'application/x-protobuf',
      'Content-Encoding': 'snappy',
      'X-Prometheus-Remote-Write-Version': '0.1.0',
      'User-Agent': 'DevPilot Grafana Cloud Publisher/1.0',
    },
    timeout: 15_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  lastPushAt = now;
  return { pushed: true, series: timeseries.length, timestamp: new Date(now).toISOString(), reason };
};
