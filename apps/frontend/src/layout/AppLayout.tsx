import { NavLink, Outlet } from 'react-router-dom';
import { Activity, FolderKanban, LayoutGrid, LineChart } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import type { AuthUser } from '../pages/Login';

const navItems = [
  { label: 'Overview', path: '/', icon: LayoutGrid },
  { label: 'Projects', path: '/projects', icon: FolderKanban },
  { label: 'Analytics', path: '/analytics', icon: LineChart },
  { label: 'Monitoring', path: '/monitoring', icon: Activity },
];

type AppLayoutProps = {
  user: AuthUser | null;
};

export const AppLayout = ({ user }: AppLayoutProps) => (
  <TooltipProvider>
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="stack-sm">
          <div className="hero-meta">
            <span className="metric-icon">
              <FolderKanban size={18} />
            </span>
            <div>
              <h2 className="text-lg font-semibold">DevPilot</h2>
              <p className="text-xs text-muted">Jira-style delivery, releases, and monitoring</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) =>
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                  end={item.path === '/'}
                >
                  <span className="nav-link-icon">
                    <item.icon size={16} />
                  </span>
                  {item.label}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Card className="surface-card space-y-2 mt-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{user?.name || 'Signed in'}</h3>
            <Badge className="bg-success/15 text-success">Active</Badge>
          </div>
          <p className="text-xs text-muted">{user?.email || 'Local account'}</p>
          <p className="text-xs text-muted">Projects, issues, releases, incidents, observability.</p>
        </Card>
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  </TooltipProvider>
);
