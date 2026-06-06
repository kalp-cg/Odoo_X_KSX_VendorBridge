'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, getDefaultRouteForRole } from '@/lib/auth';
import { PageSpinner } from '@/components/ui';

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (accessToken && user) {
      router.replace(getDefaultRouteForRole(user.role));
    } else if (!accessToken && status !== 'loading') {
      router.replace('/login');
    }
  }, [accessToken, user, status, router]);

  return <PageSpinner label="Loading VendorBridge…" />;
}
