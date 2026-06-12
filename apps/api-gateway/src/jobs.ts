import type { RealtimeEvent } from './realtime';

type Job = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
};

const queue: Job[] = [];

export const enqueueJob = (job: Job) => {
  queue.push(job);
};

export const startJobWorker = (broadcast: (event: RealtimeEvent) => void) => {
  setInterval(() => {
    const job = queue.shift();
    if (!job) return;
    broadcast({ type: 'job.completed', payload: job });
  }, 2000);
};
