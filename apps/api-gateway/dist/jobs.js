"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobWorker = exports.enqueueJob = void 0;
const queue = [];
const enqueueJob = (job) => {
    queue.push(job);
};
exports.enqueueJob = enqueueJob;
const startJobWorker = (broadcast) => {
    setInterval(() => {
        const job = queue.shift();
        if (!job)
            return;
        broadcast({ type: 'job.completed', payload: job });
    }, 2000);
};
exports.startJobWorker = startJobWorker;
