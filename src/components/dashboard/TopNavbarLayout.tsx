import { ReactNode } from 'react';
import { TopNavbar } from './TopNavbar';

interface TopNavbarLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Top Navbar Layout (Backup)
 * 
 * This is the original layout with top navigation.
 * Kept as backup in case we need to rollback.
 * 
 * To rollback: Change Layout.tsx to import and use TopNavbarLayout instead of SidebarLayout
 */
export function TopNavbarLayout({ children, className, maxWidth = '2xl' }: TopNavbarLayoutProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNavbar />
      <main className={`
        container mx-auto px-4 py-6 
        md:px-6 md:py-8 
        ${maxWidthClasses[maxWidth]}
        ${className || ''}
      `}>
        {children}
      </main>
    </div>
  );
}

