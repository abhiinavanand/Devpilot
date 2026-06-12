import { useEffect, useState } from 'react';
import { MetricCard } from '../ui/MetricCard';
import { SectionHeader } from '../ui/SectionHeader';
import { ChartsPanel } from '../ui/ChartsPanel';
import { KanbanBoard } from '../ui/KanbanBoard';
import { TimelinePanel } from '../ui/TimelinePanel';
import { TerminalPanel } from '../ui/TerminalPanel';
import { LiveMetrics } from '../ui/LiveMetrics';
import { SearchPanel } from '../ui/SearchPanel';
import { ClusterHealthCard } from '../ui/ClusterHealthCard';
import { InfrastructureCostCard } from '../ui/InfrastructureCostCard';
import { OpenIncidentsCard } from '../ui/OpenIncidentsCard';
import { AIInsightsCard } from '../ui/AIInsightsCard';
import { RecentDeploymentsTable } from '../ui/RecentDeploymentsTable';
import { LiveActivityFeed } from '../ui/LiveActivityFeed';
import { workspaceApi, type Dashboard } from '../api/workspace';

export const Overview = () => {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    workspaceApi
      .dashboard()
      .then((data) => {
        setDashboard(data);
        setError('');
      })
      .catch(() => setError('Unable to reach the API gateway. Start services/api-gateway to load live data.'));
  }, []);

  if (!dashboard) {
    return (
      <div className="card">
        <h2>{error ? 'API offline' : 'Loading command center'}</h2>
        <p className="subtle">{error || 'Fetching live workspace metrics.'}</p>
      </div>
    );
  }

  return (
    <>
    <div className="topbar">
      <div>
        <h1>Command Center</h1>
        <p className="subtle">Unified view of delivery, reliability, and roadmap execution from the API gateway.</p>
      </div>
    </div>

    <div className="grid">
      {dashboard.metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </div>
    <div className="section">
      <div className="card">
        <h3>GitHub Engineering Feed</h3>
        <p className="metric">{dashboard.githubSummary.commits}</p>
        <p className="subtle">{dashboard.githubSummary.repositories} repositories · {dashboard.githubSummary.pullRequests} pull requests</p>
        {dashboard.githubSummary.latestCommit ? (
          <p className="subtle">Latest: {dashboard.githubSummary.latestCommit.message}</p>
        ) : null}
      </div>
      <div className="card">
        <h3>DORA Metrics</h3>
        <p className="subtle">Deploy frequency: {dashboard.dora.deploymentFrequency}/day</p>
        <p className="subtle">Lead time: {dashboard.dora.leadTimeHours}h</p>
        <p className="subtle">Change failure: {dashboard.dora.changeFailureRate}% · MTTR: {dashboard.dora.mttrMinutes}m</p>
      </div>
      <div className="card">
        <h3>Kubernetes Health</h3>
        <p className="metric">{dashboard.kubernetesSummary.unhealthyPods}</p>
        <p className="subtle">unhealthy pods across {dashboard.kubernetesSummary.nodes} nodes and {dashboard.kubernetesSummary.deployments} deployments</p>
      </div>
      <div className="card">
        <h3>AI Incident Analysis</h3>
        <p className="metric">{dashboard.incidentAnalysis.riskScore}/100</p>
        <p className="subtle">{dashboard.incidentAnalysis.summary}</p>
      </div>
    </div>
    <SectionHeader title="Delivery Analytics" subtitle="DORA, release health, and reliability signals calculated from workspace records." />
    <ChartsPanel deploymentSeries={dashboard.deploymentSeries} latencySeries={dashboard.latencySeries} />
    <div className="section">
      <KanbanBoard />
      <TimelinePanel timeline={dashboard.timeline} />
    </div>
    <div className="section">
      <TerminalPanel />
      <LiveMetrics />
    </div>
    <div className="section">
      <ClusterHealthCard />
      <InfrastructureCostCard />
      <OpenIncidentsCard />
      <AIInsightsCard />
    </div>
    <div className="section">
      <RecentDeploymentsTable />
      <LiveActivityFeed />
    </div>
    <SearchPanel />
  </>
  );
};
