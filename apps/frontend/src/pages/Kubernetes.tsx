import { useEffect, useMemo, useState } from 'react';
import { workspaceApi, type KubernetesDeployment, type KubernetesNode, type KubernetesPod } from '../api/workspace';

export const Kubernetes = () => {
  const [nodes, setNodes] = useState<KubernetesNode[]>([]);
  const [pods, setPods] = useState<KubernetesPod[]>([]);
  const [deployments, setDeployments] = useState<KubernetesDeployment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    workspaceApi
      .kubernetes()
      .then((data) => {
        setNodes(data.nodes);
        setPods(data.pods);
        setDeployments(data.deployments);
        setError('');
      })
      .catch(() => setError('Unable to load Kubernetes snapshot from the API.'));
  }, []);

  const summary = useMemo(() => ({
    cpu: Math.round(nodes.reduce((sum, node) => sum + node.cpuUsagePercent, 0) / Math.max(nodes.length, 1)),
    memory: Math.round(nodes.reduce((sum, node) => sum + node.memoryUsagePercent, 0) / Math.max(nodes.length, 1)),
    restarts: pods.reduce((sum, pod) => sum + pod.restarts, 0),
    unavailableReplicas: deployments.reduce((sum, deployment) => sum + Math.max(0, deployment.desiredReplicas - deployment.availableReplicas), 0),
  }), [deployments, nodes, pods]);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2>Kubernetes Operations</h2>
        <p className="subtle">Realistic cluster inventory, pod health, node utilization, and deployment readiness.</p>
        {error ? <p className="subtle">{error}</p> : null}
      </div>

      <div className="grid">
        <div className="card"><h3>CPU</h3><p className="metric">{summary.cpu}%</p><p className="subtle">average node usage</p></div>
        <div className="card"><h3>Memory</h3><p className="metric">{summary.memory}%</p><p className="subtle">average node usage</p></div>
        <div className="card"><h3>Pod Restarts</h3><p className="metric">{summary.restarts}</p><p className="subtle">across all namespaces</p></div>
        <div className="card"><h3>Unavailable Replicas</h3><p className="metric">{summary.unavailableReplicas}</p><p className="subtle">deployment readiness gap</p></div>
      </div>

      <div className="section">
        <div className="card">
          <h3>Pods</h3>
          <div className="timeline">
            {pods.map((pod) => (
              <div className="timeline-item" key={pod.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{pod.name}</strong>
                  <p className="subtle">{pod.namespace} · {pod.status} · {pod.restarts} restarts · {pod.cpuMillicores}m CPU · {pod.memoryMi}Mi</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Deployments</h3>
          <div className="timeline">
            {deployments.map((deployment) => (
              <div className="timeline-item" key={deployment.id}>
                <span className="timeline-dot" />
                <div>
                  <strong>{deployment.name}</strong>
                  <p className="subtle">{deployment.namespace} · {deployment.availableReplicas}/{deployment.desiredReplicas} available · {deployment.image}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
