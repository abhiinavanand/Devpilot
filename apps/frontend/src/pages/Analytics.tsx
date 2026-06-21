import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { BarChart3, FolderKanban, GitBranch, ShieldAlert, SquareCheckBig } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { workspaceApi, type Dashboard, type Deployment, type Incident, type Task } from '../api/workspace';

const dateKey = (value: string) => new Date(value).toISOString().slice(0, 10);

const buildSeries = (tasks: Task[], deployments: Deployment[], incidents: Incident[]) => {
  const dates = Array.from(new Set([
    ...tasks.map((task) => dateKey(task.createdAt)),
    ...deployments.map((deployment) => dateKey(deployment.startedAt)),
    ...incidents.map((incident) => dateKey(incident.createdAt)),
  ])).sort();

  return dates.map((date) => ({
    date,
    tasks: tasks.filter((task) => dateKey(task.createdAt) === date).length,
    deployments: deployments.filter((deployment) => dateKey(deployment.startedAt) === date).length,
    incidents: incidents.filter((incident) => dateKey(incident.createdAt) === date).length,
  }));
};

export const Analytics = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useEffect(() => {
    workspaceApi.dashboard().then(setDashboard).catch(() => setDashboard(null));
    workspaceApi.tasks().then((data) => setTasks(data.tasks)).catch(() => setTasks([]));
    workspaceApi.deployments().then((data) => setDeployments(data.deployments)).catch(() => setDeployments([]));
    workspaceApi.incidents().then((data) => setIncidents(data.incidents)).catch(() => setIncidents([]));
  }, []);

  const completedTasks = tasks.filter((task) => task.status === 'DONE').length;
  const openTasks = tasks.filter((task) => task.status !== 'DONE').length;
  const series = useMemo(() => buildSeries(tasks, deployments, incidents), [tasks, deployments, incidents]);

  return (
    <div className="space-y-6">
      <div className="card hero-panel hero-panel-compact">
        <div className="hero-copy">
          <div>
            <h1>Analytics</h1>
            <p className="subtle">Project delivery analytics across issues, releases, and incidents. All values come from the records currently in DevPilot.</p>
          </div>
          <div className="hero-meta">
            <span className="status-badge status-healthy"><span className="status-badge-dot" /> Workspace trends</span>
          </div>
        </div>
      </div>

      <div className="grid">
        <MetricCard label="Projects" value={dashboard?.metrics.find((metric) => metric.label === 'Total Projects')?.value || '0'} helper="Visible projects" icon={FolderKanban} />
        <MetricCard label="Open Issues" value={String(openTasks)} helper="Issues not done yet" icon={BarChart3} />
        <MetricCard label="Completed Issues" value={String(completedTasks)} helper="Finished issue count" icon={SquareCheckBig} />
        <MetricCard label="Releases" value={String(deployments.length)} helper="Deployment records" icon={GitBranch} />
        <MetricCard label="Open Incidents" value={String(incidents.filter((incident) => incident.status !== 'Resolved').length)} helper="Unresolved incidents" icon={ShieldAlert} />
      </div>

      <div className="section">
        <ChartCard title="Issues Over Time">
          <AreaChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Area dataKey="tasks" stroke="#2563eb" fill="#93c5fd" />
          </AreaChart>
        </ChartCard>
        <ChartCard title="Deployments Over Time">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="deployments" fill="#16a34a" />
          </BarChart>
        </ChartCard>
        <ChartCard title="Incidents Over Time">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="incidents" fill="#dc2626" />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, helper, icon: Icon }: { label: string; value: string; helper: string; icon: typeof FolderKanban }) => (
  <div className="card surface-card metric-card metric-card-compact">
    <div className="metric-card-top">
      <div className="stack-sm">
        <span className="metric-kicker">Workspace metric</span>
        <h3>{label}</h3>
      </div>
      <span className="metric-icon"><Icon size={18} /></span>
    </div>
    <p className="metric">{value}</p>
    <p className="subtle">{helper}</p>
  </div>
);

const ChartCard = ({ title, children }: { title: string; children: ReactElement }) => (
  <div className="card surface-card">
    <h3>{title}</h3>
    <div className="chart-container">
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  </div>
);
