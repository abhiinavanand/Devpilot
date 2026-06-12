"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("./store");
const activity_1 = require("./activity");
const store = (0, store_1.resetStore)();
(0, activity_1.recordActivity)({ actor: 'seed', role: 'system', action: `project.created:${store.projects.length}` });
(0, activity_1.recordActivity)({ actor: 'seed', role: 'system', action: `task.created:${store.tasks.length}` });
(0, activity_1.recordActivity)({ actor: 'seed', role: 'system', action: 'project.updated:demo-data-ready' });
console.log(`Seeded ${store.projects.length} projects and ${store.tasks.length} tasks.`);
