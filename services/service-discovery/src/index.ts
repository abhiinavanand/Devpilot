import express from 'express';

const app = express();
app.use(express.json());

const registry = new Map<string, { url: string; updatedAt: string }>();

app.post('/services/register', (req: any, res: any) => {
  const { name, url } = req.body || {};
  if (!name || !url) {
    return res.status(400).json({ message: 'name and url are required' });
  }
  registry.set(name, { url, updatedAt: new Date().toISOString() });
  return res.json({ status: 'registered', name, url });
});

app.post('/services/heartbeat', (req: any, res: any) => {
  const { name } = req.body || {};
  const entry = registry.get(name);
  if (!entry) return res.status(404).json({ message: 'service not registered' });
  entry.updatedAt = new Date().toISOString();
  registry.set(name, entry);
  return res.json({ status: 'updated', name });
});

app.get('/services', (_req: any, res: any) => {
  const services = Array.from(registry.entries()).map(([name, meta]) => ({ name, ...meta }));
  return res.json({ services });
});

app.listen(4100, () => {
  console.log('Service discovery running on :4100');
});
