import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: 'card' | 'table' | 'list' | 'kpi';
}

export function LoadingSkeleton({
  className,
  count = 1,
  variant = 'card',
}: LoadingSkeletonProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case 'kpi':
        return (
          <Card className="glass-card p-6">
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              <div className="h-8 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
            </div>
          </Card>
        );
      
      case 'table':
        return (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4 p-4 border-b border-border/50">
                <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        );
      
      case 'list':
        return (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border border-border/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded bg-muted animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-32 animate-pulse" />
                    <div className="h-3 bg-muted rounded w-24 animate-pulse" />
                  </div>
                </div>
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        );
      
      case 'card':
      default:
        return (
          <Card className="glass-card p-6">
            <div className="space-y-4">
              <div className="h-5 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-full animate-pulse" />
              <div className="h-4 bg-muted rounded w-5/6 animate-pulse" />
              <div className="h-4 bg-muted rounded w-4/6 animate-pulse" />
            </div>
          </Card>
        );
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {[...Array(count)].map((_, i) => (
        <div key={i}>{renderSkeleton()}</div>
      ))}
    </div>
  );
}

// Pre-built skeleton components for common patterns
export function KPISkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <LoadingSkeleton variant="kpi" count={count} />
    </div>
  );
}

export function TableSkeleton() {
  return <LoadingSkeleton variant="table" />;
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return <LoadingSkeleton variant="list" count={count} />;
}

