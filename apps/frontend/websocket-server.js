import http from 'http';
import { Server } from "socket.io";

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const activities = [
  'Deployment succeeded',
  'AI generated RCA',
  'GitHub PR merged',
  'Cluster autoscaled',
  'Incident resolved',
];

io.on('connection', (socket) => {
  console.log('a user connected');
  
  const interval = setInterval(() => {
    const message = activities[Math.floor(Math.random() * activities.length)];
    socket.emit('new-activity', { message, timestamp: new Date() });
  }, 5000);

  socket.on('disconnect', () => {
    console.log('user disconnected');
    clearInterval(interval);
  });
});

server.listen(3001, () => {
  console.log('listening on *:3001');
});
