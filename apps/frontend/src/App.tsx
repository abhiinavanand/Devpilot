import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Button } from './components/ui/button';
import { ToastHost } from './components/ui/toast-context';
import { Analytics } from './pages/Analytics';
import { Login } from './pages/Login';
import { ProjectDetail } from './pages/ProjectDetail';
import { Monitoring } from './pages/Monitoring';

const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('devpilot.authenticated') === 'true');

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const logout = () => {
    localStorage.removeItem('devpilot.authenticated');
    setAuthenticated(false);
  };

  return (
    <ToastHost>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login authenticated={authenticated} onLogin={() => setAuthenticated(true)} />} />
          <Route
            element={
              authenticated ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-card px-6 py-5">
                    <div>
                      <h1 className="text-2xl font-semibold">DevPilot AI</h1>
                      <p className="text-sm text-muted">Projects, deployments, and monitoring</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                        {theme === 'light' ? 'Dark mode' : 'Light mode'}
                      </Button>
                      <Button variant="subtle" onClick={logout}>Logout</Button>
                    </div>
                  </div>
                  <AppLayout />
                </>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="monitoring" element={<Monitoring />} />
          </Route>
          <Route path="*" element={<Navigate to={authenticated ? '/' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastHost>
  );
};

export default App;
