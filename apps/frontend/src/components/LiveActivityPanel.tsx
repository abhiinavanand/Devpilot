import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  message: string;
  timestamp: Date;
}

export const LiveActivityPanel = () => {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:3000/realtime');

    socket.onopen = () => {
      console.log('Connected to realtime server');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        setActivities((prev) => [
          {
            message:
              data.payload?.message ||
              data.type ||
              JSON.stringify(data.payload ?? data),
            timestamp: new Date(),
          },
          ...prev,
        ]);
      } catch (err) {
        console.error('Failed to parse realtime message:', err);
      }
    };

    socket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    socket.onclose = () => {
      console.log('Realtime connection closed');
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-lg font-semibold mb-4">Live Activity</h2>

      {activities.length === 0 ? (
        <p className="text-sm text-gray-500">
          Waiting for realtime events...
        </p>
      ) : (
        <ul>
          {activities.map((activity, index) => (
            <li key={index} className="mb-2">
              <p>{activity.message}</p>
              <p className="text-sm text-gray-500">
                {formatDistanceToNow(activity.timestamp, {
                  addSuffix: true,
                })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};