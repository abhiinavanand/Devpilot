import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'auth-service', timestamp: new Date().toISOString() });
});

app.post('/register', (req, res) => {
  res.status(201).json({ user: { id: 'demo-user', email: req.body?.email || 'demo@devpilot.local' } });
});

app.post('/login', (req, res) => {
  res.json({ token: 'demo-token', user: { id: 'demo-user', email: req.body?.email || 'demo@devpilot.local' } });
});

app.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Auth Service is running on port ${PORT}`);
});
