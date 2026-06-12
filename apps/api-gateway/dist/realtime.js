"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRealtimeServer = void 0;
const ws_1 = require("ws");
const createRealtimeServer = (server) => {
    const wss = new ws_1.WebSocketServer({ server, path: '/realtime' });
    wss.on('connection', (socket) => {
        socket.send(JSON.stringify({
            type: 'welcome',
            payload: { message: 'Connected to DevPilot Realtime Hub.' },
        }));
    });
    const broadcast = (event) => {
        const message = JSON.stringify(event);
        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    };
    return { broadcast };
};
exports.createRealtimeServer = createRealtimeServer;
