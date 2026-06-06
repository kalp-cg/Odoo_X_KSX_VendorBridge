'use client';

import { Search } from 'lucide-react';
import { Input } from './Field';
import { cn, debounce } from '@/lib/utils';
import { ChangeEvent, useMemo } from 'react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, debounceMs = 300 }: SearchInputProps) {
  const handler = useMemo(() => debounce((v: string) => onChange(v), debounceMs), [onChange, debounceMs]);
  return (
    <div className={cn('relative', className)}>
      <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
      <Input
        defaultValue={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => handler(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
