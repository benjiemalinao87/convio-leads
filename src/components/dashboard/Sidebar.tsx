import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Users,
  Settings,
  FolderOpen,
  TrendingUp,
  Calendar,
  BookOpen,
  Menu,
  X,
  User as UserIcon,
  Moon,
  Sun,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';

// Organized navigation with categories
const navigationGroups = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/', icon: BarChart3, badge: null },
    ]
  },
  {
    title: 'Leads & Contacts',
    items: [
      { name: 'Contacts', href: '/contacts', icon: Users, badge: null },
      { name: 'Appointments', href: '/appointments', icon: Calendar, badge: null },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { name: 'Analytics', href: '/analytics', icon: TrendingUp, badge: null },
    ]
  },
  {
    title: 'Configuration',
    items: [
      { name: 'Webhooks', href: '/webhooks', icon: FolderOpen, badge: null },
      { name: 'Settings', href: '/settings', icon: Settings, badge: null },
    ]
  },
  {
    title: 'Resources',
    items: [
      { name: 'Documentation', href: '/docs', icon: BookOpen, badge: null },
    ]
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Filter navigation based on user permission type
  const getFilteredNavigation = () => {
    if (user?.permission_type === 'provider') {
      // Providers see Contacts, Appointments, Analytics, and Settings
      return [
        {
          title: 'Leads & Contacts',
          items: [
            { name: 'Contacts', href: '/contacts', icon: Users, badge: null },
            { name: 'Appointments', href: '/appointments', icon: Calendar, badge: null },
          ]
        },
        {
          title: 'Analytics',
          items: [
            { name: 'Analytics', href: '/analytics', icon: TrendingUp, badge: null },
          ]
        },
        {
          title: 'Configuration',
          items: [
            { name: 'Settings', href: '/settings', icon: Settings, badge: null },
          ]
        },
      ];
    }
    // Admin and Dev see all navigation
    return navigationGroups;
  };

  const filteredNavigation = getFilteredNavigation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden h-11 w-11"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-[270px] border-r border-border/50 bg-card transition-all duration-300 ease-in-out",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isCollapsed && "md:w-20"
      )}>
        <div className="flex h-full flex-col">
          {/* Logo Section */}
          <div className="flex items-center justify-between px-6 py-7 border-b border-border/50">
            <div className="flex items-center space-x-3 w-full">
              <div className="h-10 w-10 rounded-lg bg-gradient-primary flex items-center justify-center shrink-0">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              {(!isCollapsed || mobileMenuOpen) && (
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg font-bold gradient-text truncate">BuyerFound</h1>
                  <p className="text-xs text-muted-foreground truncate">Analytics Dashboard</p>
                </div>
              )}
            </div>
            {/* Collapse Toggle Button (Desktop) */}
            {(!isCollapsed || mobileMenuOpen) && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-8 w-8 shrink-0"
                onClick={onToggleCollapse}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            {isCollapsed && !mobileMenuOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-8 w-8 shrink-0 mx-auto"
                onClick={onToggleCollapse}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-3 overflow-y-auto">
            <div className="space-y-3">
              {filteredNavigation.map((group, groupIndex) => {
                return (
                  <div key={group.title} className="space-y-1">
                    {/* Group Title (only show when not collapsed) */}
                    {(!isCollapsed || mobileMenuOpen) && (
                      <div className="px-3 py-1.5">
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {group.title}
                        </h3>
                      </div>
                    )}

                    {/* Group Items */}
                    <ul className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.href ||
                          (item.href !== '/' && location.pathname.startsWith(item.href));
                        return (
                          <li key={item.name}>
                            <NavLink
                              to={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={cn(
                                "w-full flex items-center px-4 py-3 rounded-lg text-base font-medium transition-all duration-200 group relative",
                                isActive
                                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                              )}
                            >
                              <item.icon className={cn(
                                "h-6 w-6 shrink-0 transition-colors",
                                (!isCollapsed || mobileMenuOpen) ? "mr-3" : "mx-auto",
                                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                              )} />
                              {(!isCollapsed || mobileMenuOpen) && (
                                <>
                                  <span className="flex-1 text-left">{item.name}</span>
                                  {item.badge && (
                                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                                      {item.badge}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Separator between groups (except last) */}
                    {groupIndex < filteredNavigation.length - 1 && (!isCollapsed || mobileMenuOpen) && (
                      <Separator className="my-2" />
                    )}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Actions Section */}
          <div className="p-4 border-t border-border/50 space-y-2">
            {/* Theme Toggle */}
            {(!isCollapsed || mobileMenuOpen) ? (
              <Button
                variant="ghost"
                onClick={toggleTheme}
                className="w-full h-10 justify-start px-3"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5 mr-2" />
                ) : (
                  <Moon className="h-5 w-5 mr-2" />
                )}
                <span className="text-sm">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="w-full h-10"
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            )}

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-auto p-3 hover:bg-secondary/50"
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-success flex items-center justify-center shrink-0">
                    <UserIcon className="h-5 w-5 text-success-foreground" />
                  </div>
                  {(!isCollapsed || mobileMenuOpen) && (
                    <div className="flex-1 min-w-0 ml-3 text-left">
                      <p className="text-sm font-medium text-foreground truncate">{user?.email || 'User'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user?.permission_type === 'admin' ? 'Administrator' :
                          user?.permission_type === 'dev' ? 'Developer' :
                            user?.permission_type === 'provider' ? 'Provider' : 'User'}
                      </p>
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" side={isCollapsed ? 'right' : 'left'}>
                <DropdownMenuItem className="flex items-center space-x-2 cursor-default">
                  <UserIcon className="h-4 w-4" />
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user?.email || 'User'}</span>
                    <span className="text-xs text-muted-foreground">
                      {user?.permission_type === 'admin' ? 'Administrator' :
                        user?.permission_type === 'dev' ? 'Developer' :
                          user?.permission_type === 'provider' ? 'Provider' : 'User'}
                    </span>
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
        </div>
      </aside>

      {/* Mobile backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
