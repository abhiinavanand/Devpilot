import { resetStore } from './store';
import { clearActivity } from './activity';

const store = resetStore();
clearActivity();

console.log(`Cleared local data. Projects: ${store.projects.length}, tasks: ${store.tasks.length}.`);
