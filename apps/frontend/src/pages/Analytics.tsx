import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { workspaceApi, type AnalyticsSummary } from '../api/workspace';

export const Analytics = () => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    workspaceApi
      .analyticsSummary()
      .then((data) => {
        setAnalytics(data);
        setError('');
      })
      .catch(() => setError('Analytics require the API gateway.'));
  }, []);

  if (!analytics) {
    return <div className="card"><h2>{error || 'Loading analytics'}</h2></div>;
  }

  const cards = [
    ['Total Projects', analytics.cards.totalProjects],
    ['Active Projects', analytics.cards.activeProjects],
    ['Open Tasks', analytics.cards.openTasks],
    ['Completed Tasks', analytics.cards.completedTasks],
    ['Deployments', analytics.cards.deployments],
    ['Incidents', analytics.cards.incidents],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1>Analytics</h1>
        <p className="subtle">Database-derived project, task, deployment, and incident trends.</p>
      </div>

      <div className="grid">
        {cards.map(([label, value]) => (
          <div className="card" key={label}>
            <h3>{label}</h3>
            <p className="metric">{value}</p>
          </div>
        ))}
      </div>

      <div className="section">
        <Chart title="Tasks Over Time" dataKey="tasks" data={analytics.series} />
        <Chart title="Projects Over Time" dataKey="projects" data={analytics.series} />
      </div>
      <div className="section">
        <BarChartCard title="Deployments Per Week" dataKey="deployments" data={analytics.series} />
        <BarChartCard title="Incidents Per Week" dataKey="incidents" data={analytics.series} />
      </div>
    </div>
  );
};

const Chart = ({ title, dataKey, data }: { title: string; dataKey: string; data: AnalyticsSummary['series'] }) => (
  <div className="card">
    <h3>{title}</h3>
    <div className="chart-container">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Area dataKey={dataKey} stroke="#2563eb" fill="#93c5fd" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const BarChartCard = ({ title, dataKey, data }: { title: string; dataKey: string; data: AnalyticsSummary['series'] }) => (
  <div className="card">
    <h3>{title}</h3>
    <div className="chart-container">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey={dataKey} fill="#16a34a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);
