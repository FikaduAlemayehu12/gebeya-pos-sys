import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  titleAm?: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  variant?: 'default' | 'primary' | 'gold' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'bg-card',
  primary: 'gradient-primary text-primary-foreground',
  gold: 'gradient-gold text-gold-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  destructive: 'bg-destructive text-destructive-foreground',
};

const iconBgStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-foreground/20 text-primary-foreground',
  gold: 'bg-gold-foreground/15 text-gold-foreground',
  success: 'bg-success-foreground/20 text-success-foreground',
  warning: 'bg-warning-foreground/15 text-warning-foreground',
  destructive: 'bg-destructive-foreground/20 text-destructive-foreground',
};

export default function StatCard({ title, titleAm, value, change, changeType = 'neutral', icon: Icon, variant = 'default' }: StatCardProps) {
  return (
    <div className={cn('rounded-xl p-5 stat-card-shadow animate-fade-up', variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn('text-sm font-medium', variant === 'default' ? 'text-muted-foreground' : 'opacity-85')}>
            {title}
          </p>
          {titleAm && (
            <p className={cn('text-[10px] font-ethiopic', variant === 'default' ? 'text-muted-foreground' : 'opacity-60')}>
              {titleAm}
            </p>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBgStyles[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        {change && (
          <p className={cn(
            'text-xs mt-1 font-medium',
            changeType === 'positive' && (variant === 'default' ? 'text-success' : 'opacity-80'),
            changeType === 'negative' && (variant === 'default' ? 'text-destructive' : 'opacity-80'),
            changeType === 'neutral' && (variant === 'default' ? 'text-muted-foreground' : 'opacity-70'),
          )}>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}
