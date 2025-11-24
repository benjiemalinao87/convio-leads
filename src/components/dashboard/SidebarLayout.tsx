import { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface SidebarLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

export function SidebarLayout({ children, className, maxWidth = '2xl' }: SidebarLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div 
        className={cn(
          "flex flex-col min-w-0 transition-all duration-300 min-h-screen",
          "md:ml-[270px]",
          sidebarCollapsed && "md:ml-20"
        )}
      >
        {/* Page Content */}
        <main className={cn(
          "flex-1 overflow-y-auto p-5 md:p-7",
          maxWidthClasses[maxWidth],
          "mx-auto w-full",
          className
        )}>
          {children}
        </main>
      </div>
    </div>
  );
}

