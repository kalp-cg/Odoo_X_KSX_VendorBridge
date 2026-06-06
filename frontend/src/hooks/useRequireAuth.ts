'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getDefaultRouteForRole } from '@/lib/auth';
import type { UserRole } from '@/lib/types';

export function useRequireAuth(requiredRoles?: UserRole[]): {
  user: ReturnType<typeof useAuthStore.getState>['user'];
  status: ReturnType<typeof useAuthStore.getState>['status'];
} {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!accessToken && status === 'idle') {
      router.replace('/login');
      return;
    }
    if (accessToken && !user) {
      fetchMe().then((u) => {
        if (!u) router.replace('/login');
      });
    } else if (!accessToken && status !== 'loading') {
      router.replace('/login');
    }
  }, [accessToken, user, status, fetchMe, router]);

  useEffect(() => {
    if (user && requiredRoles && !requiredRoles.includes(user.role)) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [user, requiredRoles, router]);

  return { user, status };
}
