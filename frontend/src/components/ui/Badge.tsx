'use client';

import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({
  children,
  className,
  ...rest
}: { children: React.ReactNode } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={cn('badge bg-ink-100 text-ink-700', className)} {...rest}>
      {children}
    </span>
  );
}

interface StatusPillProps {
  status: string;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  const tone = (() => {
    switch (status) {
      case 'PENDING_VERIFICATION':
        return 'bg-amber-100 text-amber-800';
      case 'ACTIVE':
      case 'APPROVED':
      case 'DELIVERED':
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800';
      case 'INACTIVE':
      case 'SUPERSEDED':
      case 'DRAFT':
      case 'GENERATED':
        return 'bg-ink-200 text-ink-700';
      case 'BLOCKED':
      case 'REJECTED':
      case 'CANCELLED':
      case 'OVERDUE':
        return 'bg-red-100 text-red-700';
      case 'PUBLISHED':
      case 'SENT':
        return 'bg-blue-100 text-blue-800';
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800';
      case 'SHORTLISTED':
        return 'bg-violet-100 text-violet-800';
      case 'ACCEPTED':
        return 'bg-emerald-100 text-emerald-800';
      case 'PENDING':
        return 'bg-amber-100 text-amber-800';
      case 'CLOSED':
        return 'bg-ink-300 text-ink-800';
      default:
        return 'bg-ink-200 text-ink-700';
    }
  })();
  return (
    <span className={cn('badge', tone, className)}>
      {status
        .split('_')
        .map((p) => p[0] + p.slice(1).toLowerCase())
        .join(' ')}
    </span>
  );
}
