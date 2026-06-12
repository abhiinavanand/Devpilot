"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatResponse = void 0;
const store_1 = require("./store");
const generateChatResponse = (prompt) => {
    const store = (0, store_1.readStore)();
    const dora = (0, store_1.calculateDoraMetrics)();
    const analysis = (0, store_1.analyzeIncidents)();
    const openTasks = store.tasks.filter((task) => task.status !== 'DONE');
    const riskyDeployments = store.deployments.filter((deployment) => ['Running', 'Failed', 'Rolled Back'].includes(deployment.status));
    const lowestBudget = [...store.slos].sort((a, b) => a.errorBudgetRemaining - b.errorBudgetRemaining)[0];
    const focus = prompt.trim() || 'current delivery risk';
    return [
        `Summary for "${focus}":`,
        `${openTasks.length} active work items need attention, with ${openTasks.filter((task) => task.priority === 'Critical' || task.priority === 'High').length} high-priority items.`,
        riskyDeployments.length
            ? `Watch ${riskyDeployments.map((deployment) => `${deployment.service} (${deployment.status})`).join(', ')} before the next promotion.`
            : 'No risky deployments are currently active.',
        lowestBudget
            ? `${lowestBudget.service} has the tightest SLO budget at ${lowestBudget.errorBudgetRemaining}%.`
            : 'No SLO records are available yet.',
        `DORA snapshot: ${dora.deploymentFrequency}/day deployments, ${dora.leadTimeHours}h lead time, ${dora.changeFailureRate}% change failure rate, ${dora.mttrMinutes}m MTTR.`,
        `Incident analysis: ${analysis.summary}`,
        `Recommended action: ${analysis.recommendations[0]}`,
    ].join('\n');
};
exports.generateChatResponse = generateChatResponse;
