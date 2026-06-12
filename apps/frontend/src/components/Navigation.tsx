import {
  LayoutDashboard,
  Folder,
  Rocket,
  AlertTriangle,
  Share2,
  Code,
  BarChart,
  Bot,
  Users,
  Plug,
  FileText,
  DollarSign,
  Settings,
  Book,
} from 'lucide-react';

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Folder },
  { href: '/deployments', label: 'Deployments', icon: Rocket },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/kubernetes', label: 'Kubernetes', icon: Share2 },
  { href: '/github', label: 'GitHub', icon: Code },
  { href: '/analytics', label: 'Analytics', icon: BarChart },
  { href: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { href: '/teams', label: 'Teams', icon: Users },
  { href: '/integrations', label: 'Integrations', icon: Plug },
  { href: '/audit-logs', label: 'Audit Logs', icon: FileText },
  { href: '/billing', label: 'Billing', icon: DollarSign },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/documentation', label: 'Documentation', icon: Book },
];

export const Navigation = () => {
  return (
    <aside className="w-64 bg-gray-800 text-white p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">SaaS</h1>
      </div>
      <nav>
        <ul>
          {navigationItems.map((item) => (
            <li key={item.label}>
              <a href={item.href} className="flex items-center p-2 rounded-lg hover:bg-gray-700">
                <item.icon className="w-5 h-5 mr-3" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
};
