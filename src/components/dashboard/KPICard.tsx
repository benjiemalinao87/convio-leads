import { useState } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  iconColor?: string;
  className?: string;
}

export function KPICard({ 
  title, 
  value, 
  subtitle,
  icon: Icon, 
  trend, 
  iconColor = 'text-primary',
  className 
}: KPICardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Map iconColor class to hex value
  const getColorValue = (colorClass: string) => {
    // Extract from CSS variables or use defaults
    const colorMap: Record<string, string> = {
      'text-primary': 'hsl(217, 91%, 60%)',
      'text-success': 'hsl(142, 76%, 36%)',
      'text-warning': 'hsl(38, 92%, 50%)',
      'text-destructive': 'hsl(0, 84%, 60%)',
      'text-blue-600': '#2563eb',
      'text-green-600': '#16a34a',
      'text-orange-600': '#ea580c',
      'text-slate-600': '#475569',
      'text-emerald-600': '#059669',
      'text-purple-600': '#9333ea',
      'text-red-600': '#dc2626',
    };
    return colorMap[colorClass] || 'hsl(217, 91%, 60%)';
  };

  const colorValue = getColorValue(iconColor);

  return (
    <div 
      className={cn(
        "group bg-card rounded-xl border border-border p-4 transition-all duration-300 cursor-pointer overflow-hidden relative",
        className
      )}
      style={{
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: isHovered 
          ? '0 8px 16px -4px rgba(0, 0, 0, 0.12), 0 4px 8px -2px rgba(0, 0, 0, 0.08)' 
          : '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background gradient */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, ${colorValue}08 0%, transparent 50%)`,
        }}
      />

      {/* Top border accent */}
      <div 
        className="absolute top-0 left-0 right-0 h-0.5 transition-all duration-300"
        style={{
          background: colorValue,
          transform: isHovered ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left',
        }}
      />

      <div className="flex items-start justify-between relative">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
            {title}
          </p>
          <p 
            className="text-2xl font-bold text-foreground mb-1 transition-all duration-300"
            style={{
              transform: isHovered ? 'scale(1.03)' : 'scale(1)',
              transformOrigin: 'left',
            }}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground font-medium">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span className={cn(
                "text-xs font-bold px-1.5 py-0.5 rounded-md",
                trend.isPositive 
                  ? 'text-success bg-success/10 dark:bg-success/20' 
                  : 'text-destructive bg-destructive/10 dark:bg-destructive/20'
              )}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-[10px] text-muted-foreground">vs last period</span>
            </div>
          )}
        </div>
        
        {/* Icon container */}
        <div 
          className="relative p-2 rounded-lg transition-all duration-300 shrink-0 ml-2"
          style={{
            backgroundColor: isHovered ? colorValue : 'hsl(var(--muted))',
            transform: isHovered ? 'scale(1.05) rotate(3deg)' : 'scale(1) rotate(0deg)',
            boxShadow: isHovered ? `0 4px 8px -2px ${colorValue}40` : 'none',
          }}
        >
          <Icon 
            className="w-5 h-5 transition-all duration-300" 
            style={{
              color: isHovered ? 'white' : colorValue,
            }}
          />
          
          {/* Pulse effect */}
          {isHovered && (
            <div 
              className="absolute inset-0 rounded-lg animate-ping opacity-30"
              style={{ backgroundColor: colorValue }}
            />
          )}
        </div>
      </div>
    </div>
  );
}