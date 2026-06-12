import type { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export type RealtimeEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export const createRealtimeServer = (server: HttpServer) => {
  const wss = new WebSocketServer({ server, path: '/realtime' });

  wss.on('connection', (socket: WebSocket) => {
    socket.send(
      JSON.stringify({
        type: 'welcome',
        payload: { message: 'Connected to DevPilot Realtime Hub.' },
      })
    );
  });

  const broadcast = (event: RealtimeEvent) => {
    const message = JSON.stringify(event);
  wss.clients.forEach((client: WebSocket) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  };

  return { broadcast };
};
