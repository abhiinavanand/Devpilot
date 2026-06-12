import React from 'react';
import { Command } from 'cmdk';
import Fuse from 'fuse.js';

const deployments = [{ id: '1', name: 'Deployment 1' }, { id: '2', name: 'Deployment 2' }];
const incidents = [{ id: '1', name: 'Incident 1' }, { id: '2', name: 'Incident 2' }];
const projects = [{ id: '1', name: 'Project 1' }, { id: '2', name: 'Project 2' }];
const teams = [{ id: '1', name: 'Team 1' }, { id: '2', name: 'Team 2' }];
const repositories = [{ id: '1', name: 'Repository 1' }, { id: '2', name: 'Repository 2' }];

const allItems = [
  ...deployments.map(d => ({ ...d, type: 'Deployment' })),
  ...incidents.map(i => ({ ...i, type: 'Incident' })),
  ...projects.map(p => ({ ...p, type: 'Project' })),
  ...teams.map(t => ({ ...t, type: 'Team' })),
  ...repositories.map(r => ({ ...r, type: 'Repository' })),
];

const fuse = new Fuse(allItems, {
  keys: ['name'],
  includeScore: true,
  threshold: 0.3,
});

export const CommandSearch = () => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const results = search ? fuse.search(search).map(result => result.item) : allItems;

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Global Command Search">
      <Command.Input value={search} onValueChange={setSearch} placeholder="Search..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        <Command.Group heading="Deployments">
          {results.filter(item => item.type === 'Deployment').map((item) => (
            <Command.Item key={item.id}>{item.name}</Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Incidents">
          {results.filter(item => item.type === 'Incident').map((item) => (
            <Command.Item key={item.id}>{item.name}</Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Projects">
          {results.filter(item => item.type === 'Project').map((item) => (
            <Command.Item key={item.id}>{item.name}</Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Teams">
          {results.filter(item => item.type === 'Team').map((item) => (
            <Command.Item key={item.id}>{item.name}</Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Repositories">
          {results.filter(item => item.type === 'Repository').map((item) => (
            <Command.Item key={item.id}>{item.name}</Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="AI">
          <Command.Item onSelect={() => console.log('AI action')}>Ask AI</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
};
