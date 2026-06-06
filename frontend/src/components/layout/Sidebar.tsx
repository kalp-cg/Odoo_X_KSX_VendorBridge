'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  FileText,
  GitCompare,
  ShieldCheck,
  ShoppingCart,
  Receipt,
  BarChart3,
  Activity,
  LogOut,
  Bell,
} from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { cn, roleLabel } from '@/lib/utils';
import type { UserRole } from '@/lib/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'OFFICER', 'MANAGER', 'VENDOR'] },
  { href: '/vendors', label: 'Vendors', icon: Users, roles: ['ADMIN', 'OFFICER'] },
  { href: '/rfqs', label: 'RFQs', icon: FileSpreadsheet, roles: ['ADMIN', 'OFFICER', 'VENDOR'] },
  { href: '/quotations', label: 'Quotations', icon: FileText, roles: ['ADMIN', 'OFFICER', 'VENDOR', 'MANAGER'] },
  { href: '/approvals', label: 'Approvals', icon: ShieldCheck, roles: ['ADMIN', 'MANAGER'] },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, roles: ['ADMIN', 'OFFICER', 'VENDOR'] },
  { href: '/invoices', label: 'Invoices', icon: Receipt, roles: ['ADMIN', 'OFFICER', 'VENDOR'] },
  { href: '/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'OFFICER', 'MANAGER'] },
  { href: '/activity', label: 'Activity', icon: Activity, roles: ['ADMIN', 'OFFICER', 'MANAGER', 'VENDOR'] },
  { href: '/notifications', label: 'Notifications', icon: Bell, roles: ['ADMIN', 'OFFICER', 'MANAGER', 'VENDOR'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const items = NAV.filter((n) => (user ? n.roles.includes(user.role) : false));

  return (
    <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-ink-100 h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-ink-100 flex items-center gap-2">
        <div className="h-9 w-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold">V</div>
        <div>
          <div className="font-semibold text-ink-800 leading-tight">VendorBridge</div>
          <div className="text-[11px] text-ink-500">Procurement ERP</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto vb-scroll px-3 py-4 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-700 border border-brand-100'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-800',
              )}
            >
              <Icon className={cn('h-4 w-4', active ? 'text-brand-600' : 'text-ink-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="px-3 py-3 border-t border-ink-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center text-sm font-semibold">
              {user.fullName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink-800 truncate">{user.fullName}</div>
              <div className="text-[11px] text-ink-500 truncate">{roleLabel(user.role)}</div>
            </div>
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className="text-ink-400 hover:text-red-600"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
