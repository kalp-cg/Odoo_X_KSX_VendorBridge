'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

export function Card({ children, className, padded = true }: CardProps) {
  return <div className={cn('card', padded && 'p-5', className)}>{children}</div>;
}

export function CardHeader({ title, description, action, icon, className }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="flex items-start gap-2 min-w-0">
        {icon && <div className="text-ink-400 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-ink-800">{title}</h3>
          {description && <p className="text-sm text-ink-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
