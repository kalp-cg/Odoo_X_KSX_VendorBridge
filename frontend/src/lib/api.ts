'use client';

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import type { ApiError, ApiErrorBody } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const TOKEN_KEY = 'vb_access';

export const tokenStore = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear: (): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await axios.post<{ data: { accessToken: string } }>(
        `${API_URL}/auth/refresh`,
        {},
        { withCredentials: true },
      );
      const token = res.data?.data?.accessToken;
      if (token) tokenStore.set(token);
      return token;
    } catch {
      return null;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetriableConfig;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (status === 401 && !original?._retry && !isAuthEndpoint) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        if (original.headers) {
          (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        }
        return api.request(original);
      }
      tokenStore.clear();
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export function extractError(err: unknown): ApiError {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const body = err.response?.data;
    if (body?.error) return body.error;
    if (err.message) return { code: 'NETWORK_ERROR', message: err.message };
  }
  if (err instanceof Error) return { code: 'UNEXPECTED', message: err.message };
  return { code: 'UNEXPECTED', message: 'Unexpected error.' };
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [k: string]: unknown;
}

export async function apiGet<T>(url: string, params?: ListQuery, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<T>(url, { params, ...config });
  return res.data;
}

export async function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<T>(url, body, config);
  return res.data;
}

export async function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.patch<T>(url, body, config);
  return res.data;
}

export async function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.put<T>(url, body, config);
  return res.data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<T>(url, config);
  return res.data;
}

export function getRawUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${API_URL.replace(/\/api\/v1$/, '')}${url}`;
}
