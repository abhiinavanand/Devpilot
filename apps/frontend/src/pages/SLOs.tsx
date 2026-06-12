import { useEffect, useState } from 'react';
import { workspaceApi, type Slo } from '../api/workspace';

export const SLOs = () => {
  const [slos, setSlos] = useState<Slo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    workspaceApi
      .slos()
      .then((data) => {
        setSlos(data.slos);
        setError('');
      })
      .catch(() => setError('Unable to load SLOs from the API.'));
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2>SLOs</h2>
        <p className="subtle">Service-level objectives, error budgets, and alert status.</p>
        {error ? <p className="subtle">{error}</p> : null}
      </div>
      <div className="grid">
        {slos.map((slo) => (
          <div className="card" key={slo.id}>
            <div className="topbar">
              <h3>{slo.service}</h3>
              <span className="badge">{slo.errorBudgetRemaining}% budget</span>
            </div>
            <p className="subtle">{slo.objective}</p>
            <p className="subtle">Target {slo.target}% · current {slo.current}%</p>
          </div>
        ))}
      </div>
    </div>
  );
};
