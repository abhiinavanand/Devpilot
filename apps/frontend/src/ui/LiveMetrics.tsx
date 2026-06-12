import { useEffect, useState } from 'react';

type LiveMetric = { label: string; value: number };

const baseMetrics: LiveMetric[] = [
  { label: 'Pipeline Health', value: 94 },
  { label: 'Error Budget', value: 86 },
  { label: 'Usage Growth', value: 72 },
];

export const LiveMetrics = () => {
  const [metrics, setMetrics] = useState(baseMetrics);
  const [lastEvent, setLastEvent] = useState('Realtime stream connected.');

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev: LiveMetric[]) =>
        prev.map((metric: LiveMetric) => ({
          ...metric,
          value: Math.max(65, Math.min(99, metric.value + (Math.random() * 6 - 3))),
        }))
      );
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000/realtime');
    socket.onmessage = (event) => {
      setLastEvent(event.data);
    };
    return () => socket.close();
  }, []);

  return (
    <div className="card">
      <h3>Live Metrics</h3>
      <div className="grid">
  {metrics.map((metric: LiveMetric) => (
          <div key={metric.label}>
            <p className="subtle">{metric.label}</p>
            <div className="metric">{metric.value.toFixed(0)}%</div>
          </div>
        ))}
      </div>
      <p className="subtle" style={{ marginTop: 10 }}>
        {lastEvent}
      </p>
    </div>
  );
};
