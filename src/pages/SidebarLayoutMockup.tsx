import { useState } from 'react';
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
  Moon,
  Sun,
  ChevronRight,
  LogOut,
  User,
  Bell,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Mock navigation items
const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3, badge: null },
  { name: 'Webhooks', href: '/webhooks', icon: FolderOpen, badge: null },
  { name: 'Contacts', href: '/contacts', icon: Users, badge: '12' },
  { name: 'Appointments', href: '/appointments', icon: Calendar, badge: '3' },
  { name: 'Analytics', href: '/analytics', icon: TrendingUp, badge: null },
  { name: 'Documentation', href: '/docs', icon: BookOpen, badge: null },
  { name: 'Settings', href: '/settings', icon: Settings, badge: null },
];

export default function SidebarLayoutMockup() {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeItem, setActiveItem] = useState('Dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className={cn("min-h-screen transition-colors duration-200", isDarkMode ? "dark" : "")}>
      <div className={cn(
        "min-h-screen flex transition-colors duration-200",
        isDarkMode 
          ? "bg-[hsl(222,47%,6%)] text-[hsl(210,40%,98%)]" 
          : "bg-[hsl(0,0%,100%)] text-[hsl(222.2,84%,4.9%)]"
      )}>
        {/* Sidebar */}
        <aside className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-64 border-r transition-transform duration-300 ease-in-out",
          isDarkMode 
            ? "bg-[hsl(224,44%,8%)] border-[hsl(215,20%,20%)]" 
            : "bg-white border-[hsl(214.3,31.8%,91.4%)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          !sidebarOpen && "md:w-20"
        )}>
          <div className="flex h-full flex-col">
            {/* Logo Section */}
            <div className={cn(
              "flex items-center px-6 py-6 border-b transition-colors",
              isDarkMode 
                ? "border-[hsl(215,20%,20%)]" 
                : "border-[hsl(214.3,31.8%,91.4%)]"
            )}>
              <div className="flex items-center space-x-3 w-full">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  isDarkMode 
                    ? "bg-gradient-to-br from-[hsl(217,91%,60%)] to-[hsl(217,91%,70%)]" 
                    : "bg-gradient-to-br from-blue-500 to-blue-600"
                )}>
                  <BarChart3 className={cn(
                    "h-5 w-5",
                    isDarkMode ? "text-white" : "text-white"
                  )} />
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <h1 className={cn(
                      "text-lg font-bold truncate",
                      isDarkMode 
                        ? "bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,36%)] bg-clip-text text-transparent" 
                        : "bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent"
                    )}>
                      LeadManager
                    </h1>
                    <p className={cn(
                      "text-xs truncate",
                      isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                    )}>
                      Analytics Dashboard
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 overflow-y-auto">
              <ul className="space-y-1">
                {navigation.map((item) => {
                  const isActive = activeItem === item.name;
                  return (
                    <li key={item.name}>
                      <button
                        onClick={() => setActiveItem(item.name)}
                        className={cn(
                          "w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                          isActive
                            ? isDarkMode
                              ? "bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(217,91%,70%)] text-white shadow-lg"
                              : "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                            : isDarkMode
                              ? "text-[hsl(215,20%,65%)] hover:text-white hover:bg-[hsl(215,20%,15%)]"
                              : "text-[hsl(215.4,16.3%,46.9%)] hover:text-[hsl(222.2,84%,4.9%)] hover:bg-[hsl(210,40%,96.1%)]"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0",
                          sidebarOpen ? "mr-3" : "mx-auto"
                        )} />
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 text-left">{item.name}</span>
                            {item.badge && (
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "ml-2 h-5 px-1.5 text-xs",
                                  isDarkMode 
                                    ? "bg-[hsl(215,20%,15%)] text-white" 
                                    : "bg-[hsl(210,40%,96.1%)] text-[hsl(222.2,84%,4.9%)]"
                                )}
                              >
                                {item.badge}
                              </Badge>
                            )}
                          </>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* User Section */}
            <div className={cn(
              "p-4 border-t",
              isDarkMode 
                ? "border-[hsl(215,20%,20%)]" 
                : "border-[hsl(214.3,31.8%,91.4%)]"
            )}>
              <div className={cn(
                "flex items-center space-x-3 p-3 rounded-lg",
                isDarkMode 
                  ? "bg-[hsl(215,20%,15%)]" 
                  : "bg-[hsl(210,40%,96.1%)]"
              )}>
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  isDarkMode 
                    ? "bg-gradient-to-br from-[hsl(142,76%,36%)] to-[hsl(142,76%,46%)]" 
                    : "bg-gradient-to-br from-green-500 to-green-600"
                )}>
                  <User className="h-5 w-5 text-white" />
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium truncate",
                      isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                    )}>
                      John Admin
                    </p>
                    <p className={cn(
                      "text-xs truncate",
                      isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                    )}>
                      admin@company.com
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className={cn(
            "sticky top-0 z-40 border-b backdrop-blur-sm",
            isDarkMode 
              ? "bg-[hsl(224,44%,8%)]/95 border-[hsl(215,20%,20%)]" 
              : "bg-white/95 border-[hsl(214.3,31.8%,91.4%)]"
          )}>
            <div className="flex h-16 items-center justify-between px-4 md:px-6">
              {/* Left: Menu & Search */}
              <div className="flex items-center space-x-4 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="relative flex-1 max-w-md">
                  <Search className={cn(
                    "absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4",
                    isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                  )} />
                  <Input
                    placeholder="Search..."
                    className={cn(
                      "pl-9 w-full",
                      isDarkMode 
                        ? "bg-[hsl(215,20%,15%)] border-[hsl(215,20%,20%)]" 
                        : "bg-[hsl(210,40%,96.1%)] border-[hsl(214.3,31.8%,91.4%)]"
                    )}
                  />
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="relative"
                >
                  {isDarkMode ? (
                    <Sun className="h-5 w-5" />
                  ) : (
                    <Moon className="h-5 w-5" />
                  )}
                </Button>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                </Button>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Page Header */}
              <div>
                <h1 className={cn(
                  "text-3xl font-bold mb-2",
                  isDarkMode 
                    ? "bg-gradient-to-r from-[hsl(217,91%,60%)] to-[hsl(142,76%,36%)] bg-clip-text text-transparent" 
                    : "bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent"
                )}>
                  Dashboard Overview
                </h1>
                <p className={cn(
                  "text-sm",
                  isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                )}>
                  Track your lead performance and conversion metrics
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: 'Total Leads', value: '1,234', change: '+12.5%', icon: Users, color: 'blue' },
                  { title: 'Conversion Rate', value: '24.8%', change: '+3.2%', icon: TrendingUp, color: 'green' },
                  { title: 'Revenue', value: '$45.2K', change: '+8.1%', icon: BarChart3, color: 'purple' },
                  { title: 'Active Deals', value: '89', change: '+5', icon: Calendar, color: 'orange' },
                ].map((kpi) => (
                  <Card key={kpi.title} className={cn(
                    isDarkMode 
                      ? "bg-[hsl(224,44%,8%)] border-[hsl(215,20%,20%)]" 
                      : "bg-white border-[hsl(214.3,31.8%,91.4%)]"
                  )}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className={cn(
                        "text-sm font-medium",
                        isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                      )}>
                        {kpi.title}
                      </CardTitle>
                      <kpi.icon className={cn(
                        "h-4 w-4",
                        isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                      )} />
                    </CardHeader>
                    <CardContent>
                      <div className={cn(
                        "text-2xl font-bold mb-1",
                        isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                      )}>
                        {kpi.value}
                      </div>
                      <p className={cn(
                        "text-xs flex items-center",
                        kpi.change.startsWith('+') 
                          ? "text-green-500" 
                          : "text-red-500"
                      )}>
                        <ChevronRight className="h-3 w-3 mr-1 rotate-[-90deg]" />
                        {kpi.change} from last month
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className={cn(
                  isDarkMode 
                    ? "bg-[hsl(224,44%,8%)] border-[hsl(215,20%,20%)]" 
                    : "bg-white border-[hsl(214.3,31.8%,91.4%)]"
                )}>
                  <CardHeader>
                    <CardTitle className={cn(
                      isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                    )}>
                      Leads by Source
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {['Website', 'Social Media', 'Referral', 'Email Campaign'].map((source, i) => (
                        <div key={source} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={cn(
                              "h-3 w-3 rounded-full",
                              i === 0 ? "bg-blue-500" :
                              i === 1 ? "bg-green-500" :
                              i === 2 ? "bg-purple-500" : "bg-orange-500"
                            )} />
                            <span className={cn(
                              "text-sm font-medium",
                              isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                            )}>
                              {source}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className={cn(
                              "text-sm font-medium",
                              isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                            )}>
                              {Math.floor(Math.random() * 500) + 100}
                            </div>
                            <div className={cn(
                              "text-xs",
                              isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                            )}>
                              {Math.floor(Math.random() * 30) + 10}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(
                  isDarkMode 
                    ? "bg-[hsl(224,44%,8%)] border-[hsl(215,20%,20%)]" 
                    : "bg-white border-[hsl(214.3,31.8%,91.4%)]"
                )}>
                  <CardHeader>
                    <CardTitle className={cn(
                      isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                    )}>
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { action: 'New lead received', time: '2 min ago' },
                        { action: 'Appointment scheduled', time: '15 min ago' },
                        { action: 'Deal closed', time: '1 hour ago' },
                        { action: 'Contact updated', time: '2 hours ago' },
                      ].map((activity) => (
                        <div key={activity.action} className="flex items-center justify-between py-2">
                          <div className={cn(
                            "text-sm",
                            isDarkMode ? "text-white" : "text-[hsl(222.2,84%,4.9%)]"
                          )}>
                            {activity.action}
                          </div>
                          <div className={cn(
                            "text-xs",
                            isDarkMode ? "text-[hsl(215,20%,65%)]" : "text-[hsl(215.4,16.3%,46.9%)]"
                          )}>
                            {activity.time}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

