import { NavLink, Outlet } from 'react-router-dom';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import type { AuthUser } from '../pages/Login';

const navItems = [
  { label: 'Overview', path: '/' },
  { label: 'Projects', path: '/projects' },
];

type AppLayoutProps = {
  user: AuthUser | null;
};

export const AppLayout = ({ user }: AppLayoutProps) => (
  <TooltipProvider>
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[280px_1fr]">
      <aside className="flex flex-col gap-6 border-r border-border bg-card px-6 py-8">
        <div>
          <h2 className="text-lg font-semibold">Workspace</h2>
          <p className="text-xs text-muted">Project workflow</p>
        </div>
        <div className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-muted ${
                      isActive ? 'bg-muted text-primary' : 'text-foreground/70'
                    }`
                  }
                  end={item.path === '/'}
                >
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  {item.label}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent>{item.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Card className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{user?.name || 'Signed in'}</h3>
            <Badge className="bg-success/15 text-success">Logged in</Badge>
          </div>
          <p className="text-xs text-muted">{user?.email || 'Local account'}</p>
        </Card>
      </aside>

      <main className="space-y-6 bg-background px-6 py-8">
        <Outlet />
      </main>
    </div>
  </TooltipProvider>
);
