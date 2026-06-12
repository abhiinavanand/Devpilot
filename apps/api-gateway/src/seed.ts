import { resetStore } from './store';
import { recordActivity } from './activity';

const store = resetStore();

recordActivity({ actor: 'seed', role: 'system', action: `project.created:${store.projects.length}` });
recordActivity({ actor: 'seed', role: 'system', action: `task.created:${store.tasks.length}` });
recordActivity({ actor: 'seed', role: 'system', action: 'project.updated:demo-data-ready' });

console.log(`Seeded ${store.projects.length} projects and ${store.tasks.length} tasks.`);
