"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRecords = void 0;
const cache_1 = require("./cache");
const store_1 = require("./store");
const searchRecords = (query) => {
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `search:${normalizedQuery}`;
    const cached = cache_1.cache.get(cacheKey);
    if (cached)
        return cached;
    if (!normalizedQuery)
        return [];
    const store = (0, store_1.readStore)();
    const dataset = [
        ...store.tasks.map((task) => `${task.title} - ${task.status} - ${task.assignee}`),
        ...store.deployments.map((deployment) => `${deployment.service} ${deployment.version} - ${deployment.status}`),
        ...store.slos.map((slo) => `${slo.service} - ${slo.objective}`),
    ];
    const results = dataset.filter((item) => item.toLowerCase().includes(normalizedQuery));
    cache_1.cache.set(cacheKey, results);
    return results;
};
exports.searchRecords = searchRecords;
