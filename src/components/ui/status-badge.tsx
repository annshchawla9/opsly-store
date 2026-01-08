import React from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle2, Loader2, RotateCcw } from 'lucide-react';

type Status = 'pending' | 'in_progress' | 'completed' | 'overdue';

interface StatusBadgeProps {
  status: Status;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<Status, { 
  label: string; 
  className: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  pending: {
    label: 'Pending',
    className: 'bg-muted text-muted-foreground',
    icon: Clock,
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-primary/10 text-primary',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    className: 'bg-success/10 text-success',
    icon: CheckCircle2,
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-destructive/10 text-destructive',
    icon: AlertTriangle,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className, showIcon = true }) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium",
      config.className,
      className
    )}>
      {showIcon && <Icon className="h-3 w-3" />}
      {config.label}
    </span>
  );
};

interface RecurringBadgeProps {
  type?: 'daily_opening' | 'daily_closing' | 'weekly' | null;
  className?: string;
}

export const RecurringBadge: React.FC<RecurringBadgeProps> = ({ type, className }) => {
  if (!type) return null;

  const labels: Record<string, string> = {
    daily_opening: 'Daily Opening',
    daily_closing: 'Daily Closing',
    weekly: 'Weekly',
  };

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-secondary text-secondary-foreground",
      className
    )}>
      <RotateCcw className="h-3 w-3" />
      {labels[type] || 'Recurring'}
    </span>
  );
};
