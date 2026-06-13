import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';

export type ActivityLog = {
  id: string;
  actor: string;
  role: string;
  action: string;
  timestamp: string;
};

const dataDir = path.resolve(__dirname, '..', '.data');
const activityPath = path.join(dataDir, 'activity.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const readLogs = (): ActivityLog[] => {
  try {
    const parsed = JSON.parse(fs.readFileSync(activityPath, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLogs = (logs: ActivityLog[]) => {
  fs.writeFileSync(activityPath, JSON.stringify(logs.slice(0, 200), null, 2));
};

export const recordActivity = (entry: Omit<ActivityLog, 'id' | 'timestamp'>) => {
  const logs = readLogs();
  const log = {
    id: uuid(),
    timestamp: new Date().toISOString(),
    ...entry,
  };
  logs.unshift(log);
  writeLogs(logs);
  return log;
};

export const listActivity = () => readLogs().slice(0, 50);

export const clearActivity = () => {
  writeLogs([]);
};
