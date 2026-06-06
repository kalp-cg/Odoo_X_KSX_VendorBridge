'use client';

import { Loader2 } from 'lucide-react';

export function PageSpinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="flex flex-col items-center gap-2 text-ink-500">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={className ?? 'h-4 w-4 animate-spin'} />;
}
