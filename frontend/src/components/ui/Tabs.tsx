'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Tab {
  key: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  rightSlot?: ReactNode;
}

export function Tabs({ tabs, value, onChange, className, rightSlot }: TabsProps) {
  return (
    <div className={cn('flex items-end justify-between border-b border-ink-200 mb-4', className)}>
      <div className="flex gap-1">
        {tabs.map((t) => {
          const active = value === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800',
              )}
            >
              {t.label}
              {typeof t.count === 'number' && (
                <span
                  className={cn(
                    'ml-2 inline-flex items-center justify-center text-[10px] min-w-[18px] h-[18px] px-1 rounded-full',
                    active ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-600',
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {rightSlot}
    </div>
  );
}
