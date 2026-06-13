import { useEffect, useState } from 'react';
import { Activity, FolderKanban, GitBranch, ShieldAlert, SquareCheckBig } from 'lucide-react';
import { workspaceApi, type Dashboard } from '../api/workspace';
import { apiClient } from '../api/client';
import { useRealtimeListener } from '../api/realtime';

type ActivityLog = {
  id: string;
  actor: string;
  role: string;
  action: string;
  timestamp: string;
};

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

const metricIcons = [FolderKanban, Activity, SquareCheckBig, ShieldAlert, GitBranch];

export const Overview = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    workspaceApi.dashboard().then(setDashboard).catch(() => setError('Start the API gateway to load workspace data.'));
    apiClient
      .get<ActivityLog[]>('/activity')
      .then((items) => setActivity(items.filter((item) => formatActivity(item.action))))
      .catch(() => setActivity([]));
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
      <div className="card hero-panel hero-panel-compact">
        <div className="hero-copy">
          <div>
            <h1>Overview</h1>
            <p className="subtle">This dashboard is driven entirely by your project records, tasks, deployments, incidents, and health checks.</p>
          </div>
          <div className="hero-meta">
            <span className="status-badge status-healthy"><span className="status-badge-dot" /> Real data only</span>
            <span className="subtle">Recent changes, current health, and open work.</span>
          </div>
        </div>
      </div>

      <div className="grid">
        {dashboard.metrics.map((metric, index) => {
          const Icon = metricIcons[index] || Activity;
          return (
          <div className="card surface-card metric-card" key={metric.label}>
            <div className="metric-card-top">
              <div className="stack-sm">
                <span className="metric-kicker">Workspace metric</span>
                <h3>{metric.label}</h3>
              </div>
              <span className="metric-icon"><Icon size={18} /></span>
            </div>
            <div className="metric-card-value">
              <p className="metric">{metric.value}</p>
            </div>
            <p className="subtle">Calculated from your current project records.</p>
          </div>
        )})}
      </div>

      <div className="section">
        <div className="card surface-card">
          <div className="topbar">
            <div>
              <h3>Recent Activity</h3>
              <p className="subtle">Project, task, deployment, and incident events in time order.</p>
            </div>
            <span className="badge">{activity.length} events</span>
          </div>
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
            {!activity.length ? <div className="empty-state"><strong>No activity yet</strong><p className="subtle">Create a project, task, deployment, or incident to start the timeline.</p></div> : null}
          </div>
        </div>

        <div className="card surface-card">
          <div className="topbar">
            <div>
              <h3>Recent Deployments</h3>
              <p className="subtle">Latest deployment records across all of your projects.</p>
            </div>
            <span className="badge">{dashboard.deployments.length} shown</span>
          </div>
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
            {!dashboard.deployments.length ? <div className="empty-state"><strong>No deployments yet</strong><p className="subtle">Webhook deliveries or manual deployment records will appear here.</p></div> : null}
          </div>
        </div>
      </div>

      <div className="section">
        <div className="card surface-card">
          <div className="topbar">
            <div>
              <h3>Open Incidents</h3>
              <p className="subtle">Unresolved incidents grouped from active projects.</p>
            </div>
            <span className={`status-badge ${dashboard.incidents.length ? 'status-warning' : 'status-healthy'}`}>
              <span className="status-badge-dot" />
              {dashboard.incidents.length ? `${dashboard.incidents.length} open` : 'Clear'}
            </span>
          </div>
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
            {!dashboard.incidents.length ? <div className="empty-state"><strong>No open incidents</strong><p className="subtle">This workspace is currently clear.</p></div> : null}
          </div>
        </div>

        <div className="card surface-card">
          <div className="topbar">
            <div>
              <h3>Service Health</h3>
              <p className="subtle">Latest health result for each project with a configured App URL.</p>
            </div>
            <span className="badge">{dashboard.projectHealth.filter((item) => item.appUrl).length} monitored</span>
          </div>
          <div className="grid grid-dense">
            {dashboard.projectHealth.filter((item) => item.appUrl).map((item) => (
              <div className="health-row" key={item.projectId}>
                <span className={`health-dot ${item.status === 'healthy' ? 'health-dot-ok' : item.status === 'down' ? 'health-dot-bad' : ''}`} />
                <div>
                  <strong>{item.name}</strong>
                  <p className="subtle">
                    {item.status === 'unknown' ? 'No checks yet' : item.status}
                    {item.statusCode ? ` · HTTP ${item.statusCode}` : ''}
                    {item.responseTimeMs ? ` · ${item.responseTimeMs} ms` : ''}
                    {item.checkedAt ? ` · ${new Date(item.checkedAt).toLocaleTimeString()}` : ''}
                  </p>
                </div>
              </div>
            ))}
            {!dashboard.projectHealth.filter((item) => item.appUrl).length ? <div className="empty-state"><strong>No project App URLs configured</strong><p className="subtle">Add an App URL inside a project to begin health checks and Grafana monitoring.</p></div> : null}
          </div>
        </div>
      </div>
    </div>
  );
};
