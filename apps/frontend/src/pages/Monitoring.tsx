import { useEffect, useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { workspaceApi, type ServiceHealth } from '../api/workspace';

const grafanaUrl = import.meta.env.OPEN_GRAFANA_URL || import.meta.env.VITE_OPEN_GRAFANA_URL || 'http://localhost:3000';

export const Monitoring = () => {
  const [services, setServices] = useState<ServiceHealth[]>([]);

  const load = () => {
    workspaceApi.serviceHealth().then((data) => setServices(data.services)).catch(() => setServices([]));
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => ({
    healthy: services.filter((service) => service.status === 'healthy').length,
    unhealthy: services.filter((service) => service.status !== 'healthy').length,
  }), [services]);

  return (
    <div className="space-y-6">
      <div className="topbar">
        <div>
          <h1>Monitoring</h1>
          <p className="subtle">Service health in DevPilot, detailed observability in Grafana.</p>
        </div>
        <a className="toggle inline-flex items-center gap-2" href={grafanaUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Open Grafana Dashboard
        </a>
      </div>

      <div className="grid">
        <div className="card"><h3>Monitoring Summary</h3><p className="metric">{summary.healthy}</p><p className="subtle">healthy services</p></div>
        <div className="card"><h3>Needs Attention</h3><p className="metric">{summary.unhealthy}</p><p className="subtle">unhealthy services</p></div>
      </div>

      <div className="card">
        <h3>Service Health Grid</h3>
        <div className="grid">
          {services.map((service) => (
            <div className="health-row" key={service.service}>
              <span className={`health-dot ${service.status === 'healthy' ? 'health-dot-ok' : 'health-dot-bad'}`} />
              <div><strong>{service.name}</strong><p className="subtle">{service.status} · last checked {new Date(service.timestamp).toLocaleTimeString()}</p></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Recent Service Events</h3>
        <div className="timeline">
          {services.map((service) => (
            <div className="timeline-item" key={service.service}>
              <span className="timeline-dot" />
              <div><strong>{service.name} checked</strong><p className="subtle">{service.status} · {new Date(service.timestamp).toLocaleString()}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
