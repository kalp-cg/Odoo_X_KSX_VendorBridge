'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiGet, apiPost, tokenStore } from './api';
import type { ApiError, Envelope, User, UserRole, Vendor } from './types';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'unauthenticated';
  error: ApiError | null;
  login: (email: string, password: string) => Promise<User>;
  signup: (payload: SignupPayload) => Promise<User>;
  fetchMe: () => Promise<User | null>;
  logout: () => Promise<void>;
  reset: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

export interface SignupPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role?: UserRole;
  vendorCompany?: {
    legalName: string;
    displayName: string;
    gstNumber?: string;
    panNumber?: string;
    contactPhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    category?: string;
  };
}

function isActive(u: User | null | undefined): boolean {
  return !!u && u.status === 'ACTIVE';
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      status: 'idle',
      error: null,

      async login(email, password) {
        set({ status: 'loading', error: null });
        try {
          const res = await apiPost<Envelope<LoginResponse>>('/auth/login', { email, password });
          const { accessToken, user } = res.data;
          tokenStore.set(accessToken);
          set({ accessToken, user, status: isActive(user) ? 'authenticated' : 'unauthenticated' });
          if (!isActive(user)) {
            throw { code: 'ACCOUNT_INACTIVE', message: `Account is ${user.status.toLowerCase()}.` };
          }
          return user;
        } catch (err) {
          const apiErr = (err as { response?: { data?: { error?: ApiError } } })?.response?.data?.error || {
            code: 'UNEXPECTED',
            message: 'Login failed.',
          };
          set({ status: 'unauthenticated', error: apiErr });
          throw apiErr;
        }
      },

      async signup(payload) {
        set({ status: 'loading', error: null });
        try {
          const res = await apiPost<Envelope<LoginResponse>>('/auth/signup', payload);
          const { accessToken, user } = res.data;
          tokenStore.set(accessToken);
          set({ accessToken, user, status: isActive(user) ? 'authenticated' : 'unauthenticated' });
          return user;
        } catch (err) {
          const apiErr = (err as { response?: { data?: { error?: ApiError } } })?.response?.data?.error || {
            code: 'UNEXPECTED',
            message: 'Signup failed.',
          };
          set({ status: 'unauthenticated', error: apiErr });
          throw apiErr;
        }
      },

      async fetchMe() {
        try {
          const res = await apiGet<Envelope<User & { vendorCompany?: Vendor }>>('/auth/me');
          const me = res.data;
          if (me) set({ user: me, status: isActive(me) ? 'authenticated' : 'unauthenticated' });
          return me ?? null;
        } catch {
          set({ user: null, status: 'unauthenticated' });
          return null;
        }
      },

      async logout() {
        try {
          await apiPost('/auth/logout', {});
        } catch {
          /* ignore */
        } finally {
          tokenStore.clear();
          set({ user: null, accessToken: null, status: 'unauthenticated', error: null });
        }
      },

      reset() {
        set({ user: null, accessToken: null, status: 'idle', error: null });
      },

      hasRole(roles) {
        const u = get().user;
        if (!u) return false;
        return roles.includes(u.role);
      },
    }),
    {
      name: 'vb-auth',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : (undefined as unknown as Storage),
      ),
      partialize: (s) => ({ accessToken: s.accessToken }),
    },
  ),
);

export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case 'VENDOR':
      return '/quotations';
    case 'MANAGER':
      return '/approvals';
    case 'OFFICER':
      return '/dashboard';
    case 'ADMIN':
    default:
      return '/dashboard';
  }
}
