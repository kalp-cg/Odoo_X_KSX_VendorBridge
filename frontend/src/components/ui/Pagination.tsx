'use client';

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Pagination as PaginationType } from '@/lib/types';

interface PaginationProps {
  pagination: PaginationType;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ pagination, onPageChange, className }: PaginationProps) {
  const { page, totalPages, hasPrev, hasNext, total } = pagination;
  const start = (page - 1) * pagination.pageSize + 1;
  const end = Math.min(page * pagination.pageSize, total);
  return (
    <div className={cn('flex items-center justify-between text-sm text-ink-600', className)}>
      <span>
        Showing <span className="font-medium text-ink-800">{total === 0 ? 0 : start}</span> –{' '}
        <span className="font-medium text-ink-800">{end}</span> of{' '}
        <span className="font-medium text-ink-800">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <button
          className="btn-secondary h-8 px-2.5"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>
        <span className="px-3 text-ink-500">
          Page {page} of {totalPages || 1}
        </span>
        <button
          className="btn-secondary h-8 px-2.5"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
