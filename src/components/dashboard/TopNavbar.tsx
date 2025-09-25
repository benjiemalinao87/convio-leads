import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  BarChart3, 
  Users, 
  Settings, 
  FolderOpen, 
  TrendingUp,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Webhooks', href: '/webhooks', icon: FolderOpen },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function TopNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold gradient-text">LeadManager</h1>
            <p className="text-xs text-muted-foreground hidden sm:block">Analytics Dashboard</p>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 group",
                  isActive
                    ? "bg-gradient-primary text-primary-foreground shadow-glow"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <item.icon className={cn(
                  "mr-2 h-4 w-4 transition-colors",
                  isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info & Mobile Menu */}
        <div className="flex items-center space-x-4">
          {/* User info - Desktop */}
          <div className="hidden md:flex items-center space-x-3">
            <div className="h-8 w-8 rounded-full bg-gradient-success flex items-center justify-center">
              <span className="text-sm font-medium text-success-foreground">JA</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">John Admin</p>
              <p className="text-xs text-muted-foreground truncate">admin@company.com</p>
            </div>
          </div>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <DropdownMenu open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <NavLink
                        to={item.href}
                        className={cn(
                          "flex items-center w-full px-2 py-2 text-sm font-medium rounded-sm transition-all duration-200",
                          isActive
                            ? "bg-gradient-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className={cn(
                          "mr-3 h-4 w-4 transition-colors",
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
                        {item.name}
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuItem className="border-t mt-2 pt-2">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="h-8 w-8 rounded-full bg-gradient-success flex items-center justify-center">
                      <span className="text-sm font-medium text-success-foreground">JA</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">John Admin</p>
                      <p className="text-xs text-muted-foreground truncate">admin@company.com</p>
                    </div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
