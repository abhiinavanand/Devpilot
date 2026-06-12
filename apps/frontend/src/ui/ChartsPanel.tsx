import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

type DeploymentPoint = { name: string; success: number; failed: number };
type LatencyPoint = { time: string; p95: number; p99: number };

type ChartsPanelProps = {
  deploymentSeries: DeploymentPoint[];
  latencySeries: LatencyPoint[];
};

export const ChartsPanel = ({ deploymentSeries, latencySeries }: ChartsPanelProps) => (
  <div className="section">
    <div className="card">
      <h3>Latency (p95 / p99)</h3>
      <div className="chart-container">
        <ResponsiveContainer>
          <AreaChart data={latencySeries}>
            <XAxis dataKey="time" stroke="var(--text-muted)" />
            <YAxis stroke="var(--text-muted)" />
            <Tooltip />
            <Area type="monotone" dataKey="p95" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} />
            <Area type="monotone" dataKey="p99" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
    <div className="card">
      <h3>Deployment Success</h3>
      <div className="chart-container">
        <ResponsiveContainer>
          <BarChart data={deploymentSeries}>
            <XAxis dataKey="name" stroke="var(--text-muted)" />
            <YAxis stroke="var(--text-muted)" />
            <Tooltip />
            <Legend />
            <Bar dataKey="success" stackId="a" fill="#4f46e5" />
            <Bar dataKey="failed" stackId="a" fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);
