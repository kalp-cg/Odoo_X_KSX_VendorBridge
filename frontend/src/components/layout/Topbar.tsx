'use client';

import { ReactNode } from 'react';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth';
import { roleLabel } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Envelope, Notification, Paginated } from '@/lib/types';

export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  const { data: notifData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await apiGet<Envelope<Paginated<Notification>>>('/notifications', { page: 1, pageSize: 5, isRead: false });
      return res;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const unread = notifData?.data?.pagination?.total ?? 0;

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur border-b border-ink-100">
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-ink-800 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-ink-500 truncate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <Link href="/notifications" className="relative p-2 rounded-lg hover:bg-ink-50 text-ink-600" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            )}
          </Link>
          {user && (
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-ink-100 ml-1">
              <div className="h-8 w-8 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-xs font-semibold">
                {user.fullName?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <div className="leading-tight">
                <div className="text-xs font-medium text-ink-800">{user.fullName}</div>
                <div className="text-[10px] text-ink-500">{roleLabel(user.role)}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
