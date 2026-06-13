import { useEffect, useCallback } from 'react';

type RealtimeMessage = {
  type: string;
  payload: any;
};

type RealtimeListener = (message: RealtimeMessage) => void;

const listeners = new Map<string, Set<RealtimeListener>>();
let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

const getWebSocketUrl = () => {
  if (!import.meta.env.VITE_API_BASE_URL && typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    return null;
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
  return apiBase.replace('http://', 'ws://').replace('https://', 'wss://');
};

const connect = () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return;
  }

  try {
    const webSocketUrl = getWebSocketUrl();
    if (!webSocketUrl) {
      return;
    }
    ws = new WebSocket(`${webSocketUrl}/realtime`);

    ws.onmessage = (event) => {
      try {
        const message: RealtimeMessage = JSON.parse(event.data);
        const messageListeners = listeners.get(message.type);
        if (messageListeners) {
          messageListeners.forEach((listener) => listener(message));
        }
        // Also broadcast to "all" listeners
        const allListeners = listeners.get('*');
        if (allListeners) {
          allListeners.forEach((listener) => listener(message));
        }
      } catch (error) {
        console.error('Failed to parse realtime message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed, reconnecting in 3s...');
      // Reconnect after 3 seconds
      reconnectTimer = setTimeout(connect, 3000);
    };
  } catch (error) {
    console.error('Failed to connect WebSocket:', error);
    reconnectTimer = setTimeout(connect, 3000);
  }
};

const subscribe = (eventType: string, listener: RealtimeListener) => {
  if (!listeners.has(eventType)) {
    listeners.set(eventType, new Set());
  }
  listeners.get(eventType)!.add(listener);

  // Connect if not already connected
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connect();
  }

  // Return unsubscribe function
  return () => {
    const typeListeners = listeners.get(eventType);
    if (typeListeners) {
      typeListeners.delete(listener);
      if (typeListeners.size === 0) {
        listeners.delete(eventType);
      }
    }
  };
};

export const useRealtimeListener = (eventTypes: string | string[], callback: (message: RealtimeMessage) => void) => {
  const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];

  useEffect(() => {
    const unsubscribers = types.map((type) => subscribe(type, callback));

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [types, callback]);
};

export const realtimeApi = {
  subscribe,
  connect,
  disconnect: () => {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
  },
};
