import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Settings, 
  FolderOpen, 
  TrendingUp,
  Menu,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Webhooks', href: '/webhooks', icon: FolderOpen },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="secondary"
        size="sm"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col bg-gradient-card border-r border-border/50 backdrop-blur-sm">
          {/* Logo */}
          <div className="flex items-center px-6 py-8">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">LeadManager</h1>
                <p className="text-xs text-muted-foreground">Analytics Dashboard</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4">
            <ul className="space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <NavLink
                      to={item.href}
                      className={cn(
                        "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 group",
                        isActive
                          ? "bg-gradient-primary text-primary-foreground shadow-glow"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      )}
                      onClick={() => setIsOpen(false)}
                    >
                      <item.icon className={cn(
                        "mr-3 h-5 w-5 transition-colors",
                        isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      {item.name}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-border/50">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-gradient-success flex items-center justify-center">
                <span className="text-sm font-medium text-success-foreground">JA</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">John Admin</p>
                <p className="text-xs text-muted-foreground truncate">admin@company.com</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}