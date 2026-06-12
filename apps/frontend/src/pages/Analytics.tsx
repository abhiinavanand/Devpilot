import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock, FolderKanban, Gauge, RadioTower } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { workspaceApi, type AnalyticsSummary, type ServiceHealth } from '../api/workspace';

const demoAnalytics: AnalyticsSummary = {
  cards: {
    totalProjects: 5,
    activeProjects: 4,
    completedTasks: 18,
    pendingTasks: 32,
    errorRate: 2.4,
    avgResponseTime: 142,
  },
  series: Array.from({ length: 7 }, (_, index) => ({
    date: `Day ${index + 1}`,
    projects: index + 1,
    tasks: 6 + index * 2,
    requests: 80 + index * 18,
    latency: 130 + (index % 3) * 24,
  })),
};

const cardMeta = [
  ['Total Projects', 'totalProjects', FolderKanban],
  ['Active Projects', 'activeProjects', Activity],
  ['Completed Tasks', 'completedTasks', CheckCircle2],
  ['Pending Tasks', 'pendingTasks', Clock],
  ['Error Rate', 'errorRate', RadioTower],
  ['Avg Response Time', 'avgResponseTime', Gauge],
] as const;

export const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(demoAnalytics);
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [source, setSource] = useState<'live' | 'demo'>('demo');

  useEffect(() => {
    workspaceApi
      .analyticsSummary()
      .then((data) => {
        setAnalytics(data);
        setSource('live');
      })
      .catch(() => setSource('demo'));
  }, []);

  useEffect(() => {
    const loadHealth = () => {
      workspaceApi
        .serviceHealth()
        .then((data) => setServices(data.services))
        .catch(() =>
          setServices([
            { name: 'API Gateway', path: '/gateway/health', status: 'unhealthy', service: 'api-gateway', timestamp: new Date().toISOString() },
            { name: 'Auth Service', path: '/auth/health', status: 'unhealthy', service: 'auth-service', timestamp: new Date().toISOString() },
            { name: 'Project Service', path: '/project/health', status: 'unhealthy', service: 'project-service', timestamp: new Date().toISOString() },
            { name: 'Analytics Service', path: '/analytics/health', status: 'unhealthy', service: 'analytics-service', timestamp: new Date().toISOString() },
            { name: 'Notification Service', path: '/notification/health', status: 'unhealthy', service: 'notification-service', timestamp: new Date().toISOString() },
          ]),
        );
    };
    loadHealth();
    const timer = window.setInterval(loadHealth, 10000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="topbar">
        <div>
          <h1>Analytics</h1>
          <p className="subtle">Project progress, platform telemetry, and service availability.</p>
        </div>
        <span className="badge">{source === 'live' ? 'Live API data' : 'Demo fallback'}</span>
      </div>

      <div className="grid">
        {cardMeta.map(([label, key, Icon]) => (
          <div className="card" key={key}>
            <div className="topbar">
              <h3>{label}</h3>
              <Icon size={18} />
            </div>
            <p className="metric">
              {key === 'errorRate' ? `${analytics.cards[key]}%` : key === 'avgResponseTime' ? `${analytics.cards[key]}ms` : analytics.cards[key]}
            </p>
          </div>
        ))}
      </div>

      <div className="section">
        <div className="card">
          <h3>Projects Over Time</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <AreaChart data={analytics.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area dataKey="projects" stroke="#2563eb" fill="#93c5fd" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Tasks Created Per Day</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <AreaChart data={analytics.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area dataKey="tasks" stroke="#16a34a" fill="#bbf7d0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="card">
          <h3>Request Volume</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={analytics.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#7c3aed" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h3>Latency Trend</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={analytics.series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="latency" stroke="#dc2626" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="topbar">
          <h3>Service Health</h3>
          <span className="subtle">Auto-refreshes every 10 seconds</span>
        </div>
        <div className="grid">
          {services.map((service) => (
            <div className="health-row" key={service.service}>
              <span className={`health-dot ${service.status === 'healthy' ? 'health-dot-ok' : 'health-dot-bad'}`} />
              <div>
                <strong>{service.name}</strong>
                <p className="subtle">{service.path} · {new Date(service.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
