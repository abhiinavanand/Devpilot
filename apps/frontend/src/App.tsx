import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';
import { Button } from './components/ui/button';
import { ToastHost } from './components/ui/toast-context';
import { Login, type AuthUser } from './pages/Login';
import { ProjectDetail } from './pages/ProjectDetail';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('devpilot.user') || 'null') as AuthUser | null;
  } catch {
    return null;
  }
};

const App = () => {
  const routerBasename = import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL;
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('devpilot.authenticated') === 'true' && Boolean(readStoredUser()));

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const logout = () => {
    localStorage.removeItem('devpilot.authenticated');
    localStorage.removeItem('devpilot.user');
    setAuthenticated(false);
    setUser(null);
  };

  const login = (nextUser: AuthUser) => {
    setUser(nextUser);
    setAuthenticated(true);
  };

  return (
    <ToastHost>
      <BrowserRouter basename={routerBasename}>
        <Routes>
          <Route path="/login" element={<Login authenticated={authenticated} onLogin={login} />} />
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
                  <AppLayout user={user} />
                </>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          >
            <Route index element={<Overview />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id" element={<ProjectDetail />} />
            <Route path="analytics" element={<Navigate to="/projects" replace />} />
            <Route path="monitoring" element={<Navigate to="/projects" replace />} />
          </Route>
          <Route path="*" element={<Navigate to={authenticated ? '/' : '/login'} replace />} />
        </Routes>
      </BrowserRouter>
    </ToastHost>
  );
};

export default App;
