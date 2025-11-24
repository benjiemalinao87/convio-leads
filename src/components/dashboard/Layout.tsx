import { ReactNode } from 'react';
import { SidebarLayout } from './SidebarLayout';
// import { TopNavbarLayout } from './TopNavbarLayout'; // Uncomment to rollback

interface LayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Main Layout Component
 * 
 * Currently uses SidebarLayout (new sidebar design).
 * 
 * To rollback to top navbar layout:
 * 1. Comment out SidebarLayout import
 * 2. Uncomment TopNavbarLayout import
 * 3. Change <SidebarLayout> to <TopNavbarLayout> below
 */
export function Layout({ children, className, maxWidth = '2xl' }: LayoutProps) {
  // Using new SidebarLayout
  return (
    <SidebarLayout className={className} maxWidth={maxWidth}>
        {children}
    </SidebarLayout>
  );

  // To rollback, uncomment below and comment out above:
  // return (
  //   <TopNavbarLayout className={className} maxWidth={maxWidth}>
  //     {children}
  //   </TopNavbarLayout>
  // );
}