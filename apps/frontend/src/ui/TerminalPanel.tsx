export const TerminalPanel = () => (
  <div className="card">
    <h3>Release Terminal</h3>
    <div className="terminal">
      <p>$ deploy --service gateway --env prod</p>
      <p>→ canary 5% · health checks ✅</p>
      <p>→ promote to 50% · latency stable</p>
      <p>→ rollout complete · 10:21 UTC</p>
    </div>
  </div>
);
