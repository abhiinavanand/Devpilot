import { useEffect, useState } from 'react';
import { workspaceApi, type Dashboard, type ServiceHealth } from '../api/workspace';
import { apiClient } from '../api/client';
import { useRealtimeListener } from '../api/realtime';

type ActivityLog = {
  id: string;
  actor: string;
  role: string;
  action: string;
  timestamp: string;
};

const overviewServices = new Set(['api-gateway', 'project-service', 'analytics-service', 'notification-service']);

const activityLabels: Array<[string, string]> = [
  ['project.created', 'Project Created'],
  ['task.created', 'Task Created'],
  ['task.completed', 'Task Completed'],
  ['deployment.added', 'Deployment Added'],
  ['deployment.created', 'Deployment Added'],
  ['incident.created', 'Incident Created'],
];

const formatActivity = (action: string) => {
  const match = activityLabels.find(([prefix]) => action.startsWith(prefix));
  if (!match) return null;
  const detail = action.split(':').slice(1).join(':');
  return { label: match[1], detail };
};

export const Overview = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    workspaceApi.dashboard().then(setDashboard).catch(() => setError('Start the API gateway to load workspace data.'));
    apiClient
      .get<ActivityLog[]>('/activity')
      .then((items) => setActivity(items.filter((item) => formatActivity(item.action))))
      .catch(() => setActivity([]));
    workspaceApi
      .serviceHealth()
      .then((data) => setServices(data.services.filter((service) => overviewServices.has(service.service))))
      .catch(() => setServices([]));
  };

  // Subscribe to all real-time events to refresh dashboard
  useRealtimeListener('*', () => {
    load();
  });

  useEffect(() => {
    load();
    // Still keep polling as fallback, but less frequent
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  if (!dashboard) {
    return (
      <div className="card">
        <h2>{error ? 'API offline' : 'Loading workspace'}</h2>
        <p className="subtle">{error || 'Fetching project records.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1>Overview</h1>
        <p className="subtle">Workspace summary from project, task, deployment, and incident records.</p>
      </div>

      <div className="grid">
        {dashboard.metrics.map((metric) => (
          <div className="card" key={metric.label}>
            <h3>{metric.label}</h3>
            <p className="metric">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="card">
          <h3>Recent Activity</h3>
          <div className="timeline">
            {activity.slice(0, 6).map((item) => {
              const formatted = formatActivity(item.action);
              if (!formatted) return null;
              return (
                <div className="timeline-item" key={item.id}>
                  <span className="timeline-dot" />
                  <div>
                    <strong>{formatted.label}</strong>
                    <p className="subtle">{formatted.detail || item.actor} · {new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
            {!activity.length ? <p className="subtle">No activity recorded yet.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Recent Deployments</h3>
          <div className="timeline">
            {dashboard.deployments.map((deployment) => (
              <div className="timeline-item" key={deployment.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{deployment.version} · {deployment.service}</strong>
                  <p className="subtle">{deployment.environment} · {deployment.status} · {new Date(deployment.startedAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <h3>Open Incidents</h3>
          <div className="timeline">
            {dashboard.incidents.map((incident) => (
              <div className="timeline-item" key={incident.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{incident.title}</strong>
                  <p className="subtle">{incident.service} · {incident.severity} · {incident.status}</p>
                </div>
              </div>
            ))}
            {!dashboard.incidents.length ? <p className="subtle">No open incidents.</p> : null}
          </div>
        </div>

        <div className="card">
          <h3>Service Health</h3>
          <div className="grid">
            {services.map((service) => (
              <div className="health-row" key={service.service}>
                <span className={`health-dot ${service.status === 'healthy' ? 'health-dot-ok' : 'health-dot-bad'}`} />
                <div>
                  <strong>{service.name}</strong>
                  <p className="subtle">{service.status === 'healthy' ? 'Healthy' : 'Unhealthy'} · {new Date(service.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
            {!services.length ? <p className="subtle">Health checks unavailable.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
};
