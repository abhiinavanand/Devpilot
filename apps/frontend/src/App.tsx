import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CommandPalette } from './ui/CommandPalette';
import { AssistantWidget } from './ui/AssistantWidget';
import { AppLayout } from './layout/AppLayout';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Deployments } from './pages/Deployments';
import { Incidents } from './pages/Incidents';
import { SLOs } from './pages/SLOs';
import { Workbench } from './pages/Workbench';
import { Button } from './components/ui/button';
import { ToastHost } from './components/ui/toast-context';
import { CommandSearch } from './components/CommandSearch';
import { UserProfile } from './components/UserProfile';
import { LiveActivityPanel } from './components/LiveActivityPanel';
import { Kubernetes } from './pages/Kubernetes';
import { AIAssistant } from './pages/AIAssistant';
import { Sources } from './pages/Sources';
import { Analytics } from './pages/Analytics';

const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <ToastHost>
      <BrowserRouter>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
          <div>
            <h1 className="text-2xl font-semibold">DevPilot AI</h1>
            <p className="text-sm text-muted">Enterprise command center</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </Button>
            <Button variant="subtle" onClick={() => setCommandOpen(true)}>
              ⌘K Command
            </Button>
          </div>
        </div>
        <header className="flex justify-end p-4">
          <UserProfile />
        </header>

        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="deployments" element={<Deployments />} />
            <Route path="incidents" element={<Incidents />} />
            <Route path="slos" element={<SLOs />} />
            <Route path="workbench" element={<Workbench />} />
            <Route path="/kubernetes" element={<Kubernetes />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>
        </Routes>

        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
        <AssistantWidget />
        <CommandSearch />
        <main className="flex-1 p-4">
          <LiveActivityPanel />
        </main>
      </BrowserRouter>
    </ToastHost>
  );
};

export default App;
