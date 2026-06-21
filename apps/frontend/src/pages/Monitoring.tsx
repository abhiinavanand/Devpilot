import { useEffect, useState } from 'react';
import { Activity, ExternalLink, Gauge, ShieldAlert, Waypoints } from 'lucide-react';
import { workspaceApi, type MonitoringSummary, type ServiceHealth } from '../api/workspace';

const defaultGrafanaUrl = (() => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:3001' : '';
})();

const grafanaUrl = import.meta.env.VITE_OPEN_GRAFANA_URL || defaultGrafanaUrl;

export const Monitoring = () => {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);

  useEffect(() => {
    const load = () => {
      workspaceApi.serviceHealth().then((data) => setServices(data.services)).catch(() => setServices([]));
      workspaceApi.monitoringSummary().then(setSummary).catch(() => setSummary(null));
    };

    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="card hero-panel hero-panel-compact">
        <div className="hero-copy">
          <div>
            <h1>Monitoring</h1>
            <p className="subtle">Operational status for the DevPilot stack and linked project services. Use Grafana for deeper response-time and uptime drilldowns.</p>
          </div>
          <div className="hero-meta">
            {grafanaUrl ? (
              <a className="toggle inline-flex items-center gap-2" href={grafanaUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} /> Open Grafana
              </a>
            ) : (
              <span className="status-badge status-warning"><span className="status-badge-dot" /> Grafana unavailable</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid">
        <SummaryCard label="Platform Status" value={summary?.status || 'Unknown'} helper="Current aggregated state" icon={ShieldAlert} />
        <SummaryCard label="Requests" value={String(summary?.totalRequests || 0)} helper="Tracked by Prometheus middleware" icon={Activity} />
        <SummaryCard label="Uptime" value={summary?.uptimePercent != null ? `${summary.uptimePercent}%` : 'No data'} helper="Observed healthy request share" icon={Waypoints} />
        <SummaryCard label="Avg Response Time" value={summary?.avgResponseTimeMs != null ? `${summary.avgResponseTimeMs} ms` : 'No data'} helper="Mean gateway latency" icon={Gauge} />
      </div>

      <div className="card surface-card">
        <div className="topbar">
          <div>
            <h3>Service Health Grid</h3>
            <p className="subtle">Gateway and supporting services checked through their health endpoints.</p>
          </div>
          <span className="badge">{services.length} services</span>
        </div>
        <div className="grid mt-4">
          {services.map((service) => (
            <div className="health-row" key={service.name}>
              <span className={`health-dot ${service.status === 'healthy' ? 'health-dot-ok' : 'health-dot-bad'}`} />
              <div>
                <strong>{service.name}</strong>
                <p className="subtle">{service.status} · {new Date(service.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
          {!services.length ? <p className="subtle">No service health data available yet.</p> : null}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof Activity }) => (
  <div className="card surface-card metric-card metric-card-compact">
    <div className="metric-card-top">
      <div className="stack-sm">
        <span className="metric-kicker">Monitoring summary</span>
        <h3>{label}</h3>
      </div>
      <span className="metric-icon"><Icon size={18} /></span>
    </div>
    <p className="metric-sm">{value}</p>
    <p className="subtle">{helper}</p>
  </div>
);
