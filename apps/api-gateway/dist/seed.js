"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store_1 = require("./store");
const activity_1 = require("./activity");
const main = async () => {
    const store = await (0, store_1.resetStore)();
    (0, activity_1.clearActivity)();
    console.log(`Cleared local data. Projects: ${store.projects.length}, tasks: ${store.tasks.length}.`);
};
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
