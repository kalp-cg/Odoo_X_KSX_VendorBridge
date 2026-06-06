import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';
import type {
  ApprovalStatus,
  InvoiceStatus,
  PoStatus,
  QuotationStatus,
  RfqStatus,
  UserRole,
  VendorStatus,
} from './types';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const CURRENCY = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY || 'INR';

export function formatCurrency(amount: number | null | undefined, currency = CURRENCY): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatNumber(value: number | null | undefined, fractionDigits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: fractionDigits,
  }).format(Number(value));
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, pattern);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'dd MMM yyyy, HH:mm');
}

export function fromNow(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return formatDistanceToNow(date, { addSuffix: true });
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return isPast(parseISO(dueDate));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('');
}

export function roleLabel(role: UserRole): string {
  return (
    {
      ADMIN: 'Admin',
      OFFICER: 'Procurement Officer',
      MANAGER: 'Manager',
      VENDOR: 'Vendor',
    } as const
  )[role];
}

export function userStatusLabel(status: string): string {
  return (
    {
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      LOCKED: 'Locked',
      PENDING: 'Pending',
    } as Record<string, string>
  )[status] ?? status;
}

export function statusColor(
  status:
    | VendorStatus
    | RfqStatus
    | QuotationStatus
    | ApprovalStatus
    | PoStatus
    | InvoiceStatus
    | string,
): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    PENDING_VERIFICATION: { bg: 'bg-amber-100', text: 'text-amber-800' },
    ACTIVE: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    INACTIVE: { bg: 'bg-ink-200', text: 'text-ink-700' },
    BLOCKED: { bg: 'bg-red-100', text: 'text-red-700' },
    DRAFT: { bg: 'bg-ink-200', text: 'text-ink-700' },
    PUBLISHED: { bg: 'bg-blue-100', text: 'text-blue-800' },
    CLOSED: { bg: 'bg-ink-300', text: 'text-ink-800' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-700' },
    SUBMITTED: { bg: 'bg-blue-100', text: 'text-blue-800' },
    SHORTLISTED: { bg: 'bg-violet-100', text: 'text-violet-800' },
    ACCEPTED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
    SUPERSEDED: { bg: 'bg-ink-200', text: 'text-ink-700' },
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-800' },
    APPROVED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    GENERATED: { bg: 'bg-ink-200', text: 'text-ink-700' },
    SENT: { bg: 'bg-blue-100', text: 'text-blue-800' },
    DELIVERED: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    PAID: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
    OVERDUE: { bg: 'bg-red-100', text: 'text-red-700' },
  };
  return map[status] ?? { bg: 'bg-ink-200', text: 'text-ink-700' };
}

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((p) => p[0] + p.slice(1).toLowerCase())
    .join(' ');
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms = 300): (...args: Parameters<T>) => void {
  let t: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) v.forEach((item) => usp.append(k, String(item)));
    else usp.append(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}
