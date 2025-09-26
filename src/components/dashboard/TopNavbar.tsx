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
  ChevronDown,
  LogOut,
  User,
  BookOpen,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Webhooks', href: '/webhooks', icon: FolderOpen },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Appointments', href: '/appointments', icon: Calendar },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp },
  { name: 'Documentation', href: '/docs', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function TopNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    window.location.href = '/login';
  };

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
          {/* User Menu - Desktop */}
          <div className="hidden md:flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 px-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-success flex items-center justify-center">
                    <User className="h-4 w-4 text-success-foreground" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium">{user || 'User'}</span>
                    <span className="text-xs text-muted-foreground">Administrator</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem className="flex items-center space-x-2 cursor-default">
                  <User className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user || 'User'}</span>
                    <span className="text-xs text-muted-foreground">Administrator</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center space-x-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-default">
                  <div className="flex items-center space-x-3 w-full">
                    <div className="h-8 w-8 rounded-full bg-gradient-success flex items-center justify-center">
                      <User className="h-4 w-4 text-success-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{user || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">Administrator</p>
                    </div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="flex items-center space-x-2 text-destructive">
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
