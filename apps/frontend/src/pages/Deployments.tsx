import { useEffect, useState } from 'react';
import { workspaceApi, type Deployment } from '../api/workspace';

export const Deployments = () => {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    workspaceApi
      .deployments()
      .then((data) => {
        setDeployments(data.deployments);
        setError('');
      })
      .catch(() => setError('Unable to load deployments from the API.'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2>Deployments</h2>
        <p className="subtle">Release streams, canary progress, and rollback automation.</p>
        {error ? <p className="subtle">{error}</p> : null}
      </div>
      <div className="grid">
        {deployments.map((deployment) => (
          <div className="card" key={deployment.id}>
            <div className="topbar">
              <h3>{deployment.service}</h3>
              <span className="badge">{deployment.status}</span>
            </div>
            <p className="subtle">{deployment.environment} · {deployment.version}</p>
            <p className="subtle">{deployment.durationMinutes} min · {deployment.successRate}% health</p>
          </div>
        ))}
      </div>
    </div>
  );
};
