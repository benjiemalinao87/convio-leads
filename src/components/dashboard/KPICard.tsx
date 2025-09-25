import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function KPICard({ title, value, icon: Icon, trend, className }: KPICardProps) {
  return (
    <Card className={`glass-card p-6 transition-all duration-300 hover:shadow-glow ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-lg bg-gradient-primary">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        </div>
        {trend && (
          <div className={`flex items-center space-x-1 text-sm font-medium ${
            trend.isPositive ? 'text-success' : 'text-destructive'
          }`}>
            <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
          </div>
        )}
      </div>
    </Card>
  );
}