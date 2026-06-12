import express from 'express';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.post('/notifications', (req, res) => {
  res.json({
    id: `notification-${Date.now()}`,
    userId: req.body?.userId || 'demo-user',
    message: req.body?.message || 'Notification queued',
    status: 'sent',
  });
});

app.listen(PORT, () => {
  console.log(`Notification Service is running on port ${PORT}`);
});
