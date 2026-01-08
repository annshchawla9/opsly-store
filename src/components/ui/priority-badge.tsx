import React from 'react';
import { cn } from '@/lib/utils';

type Priority = 'critical' | 'high' | 'medium' | 'low';

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: 'priority-critical',
  },
  high: {
    label: 'High',
    className: 'priority-high',
  },
  medium: {
    label: 'Medium',
    className: 'priority-medium',
  },
  low: {
    label: 'Low',
    className: 'priority-low',
  },
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const config = priorityConfig[priority];

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
};
