import { resetStore } from './store';
import { clearActivity } from './activity';

const main = async () => {
  const store = await resetStore();
  clearActivity();
  console.log(`Cleared local data. Projects: ${store.projects.length}, tasks: ${store.tasks.length}.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
