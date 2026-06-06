'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { PageSpinner } from '@/components/ui';

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, status } = useRequireAuth();
  if (status !== 'authenticated' || !user) {
    return <PageSpinner label="Checking session…" />;
  }
  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
