'use client';

import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import { buildQuery } from './utils';
import type {
  Approval,
  AuditLog,
  DashboardPayload,
  Envelope,
  Invoice,
  MonthlyTrendPoint,
  Notification,
  Paginated,
  PurchaseOrder,
  Quotation,
  Rfq,
  SpendByVendorRow,
  User,
  Vendor,
  VendorPerformanceRow,
} from './types';

export const resources = {
  auth: {
    login: (email: string, password: string) =>
      apiPost<Envelope<{ accessToken: string; refreshToken: string; user: User }>>('/auth/login', { email, password }),
    signup: (payload: {
      email: string;
      password: string;
      fullName: string;
      role?: string;
      phone?: string;
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
    }) => apiPost<Envelope<{ accessToken: string; refreshToken: string; user: User }>>('/auth/signup', payload),
    me: () => apiGet<Envelope<User & { vendorCompany?: Vendor }>>('/auth/me'),
    refresh: () => apiPost<Envelope<{ accessToken: string; refreshToken: string; user: User }>>('/auth/refresh', {}),
    logout: () => apiPost<Envelope<{ ok: true }>>('/auth/logout', {}),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      apiPost<Envelope<{ ok: true }>>('/auth/change-password', body),
  },
  users: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<User>>(`/users${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<User>>(`/users/${id}`),
    create: (body: { email: string; password: string; fullName: string; role: string; phone?: string; vendorCompanyId?: string }) =>
      apiPost<Envelope<User>>('/users', body),
    update: (id: string, body: { fullName?: string; phone?: string }) => apiPatch<Envelope<User>>(`/users/${id}`, body),
    changeRole: (id: string, role: string) => apiPost<Envelope<User>>(`/users/${id}/role`, { role }),
    changeStatus: (id: string, status: string, reason?: string) =>
      apiPost<Envelope<User>>(`/users/${id}/status`, { status, reason }),
  },
  vendors: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Vendor>>(`/vendors${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<Vendor>>(`/vendors/${id}`),
    me: () => apiGet<Envelope<Vendor>>('/vendors/me'),
    create: (body: Partial<Vendor> & { legalName: string; displayName: string; contactEmail: string }) =>
      apiPost<Envelope<Vendor>>('/vendors', body),
    update: (id: string, body: Partial<Vendor>) => apiPatch<Envelope<Vendor>>(`/vendors/${id}`, body),
    changeStatus: (id: string, body: { status: string; reason?: string }) =>
      apiPost<Envelope<Vendor>>(`/vendors/${id}/status`, body),
  },
  rfqs: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Rfq>>(`/rfqs${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<Rfq>>(`/rfqs/${id}`),
    create: (body: {
      title: string;
      description?: string;
      deadline: string;
      lineItems: { lineNo?: number; description: string; quantity: number; unit: string; targetUnitPrice?: number; notes?: string }[];
      vendorIds: string[];
    }) => apiPost<Envelope<Rfq>>('/rfqs', body),
    update: (id: string, body: Partial<{ title: string; description: string; deadline: string; lineItems: { lineNo?: number; description: string; quantity: number; unit: string; targetUnitPrice?: number; notes?: string }[]; vendorIds: string[] }>) =>
      apiPatch<Envelope<Rfq>>(`/rfqs/${id}`, body),
    publish: (id: string) => apiPost<Envelope<Rfq>>(`/rfqs/${id}/publish`, {}),
    close: (id: string) => apiPost<Envelope<Rfq>>(`/rfqs/${id}/close`, {}),
    cancel: (id: string, reason: string) => apiPost<Envelope<Rfq>>(`/rfqs/${id}/cancel`, { reason }),
  },
  quotations: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Quotation>>(`/quotations${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<Quotation>>(`/quotations/${id}`),
    compareByRfq: (rfqId: string) => apiGet<Envelope<Quotation[]>>(`/quotations/compare/${rfqId}`),
    create: (body: {
      rfqId: string;
      lineItems: { rfqLineItemId: string; unitPrice: number; quantity: number; notes?: string }[];
      deliveryDate?: string;
      notes?: string;
    }) => apiPost<Envelope<Quotation>>('/quotations', body),
    update: (id: string, body: { lineItems?: { rfqLineItemId: string; unitPrice: number; quantity: number; notes?: string }[]; deliveryDate?: string; notes?: string }) =>
      apiPost<Envelope<Quotation>>(`/quotations/${id}/update`, body),
    shortlist: (id: string) => apiPost<Envelope<Quotation>>(`/quotations/${id}/shortlist`, {}),
    reject: (id: string, reason?: string) => apiPost<Envelope<Quotation>>(`/quotations/${id}/reject`, { reason }),
  },
  approvals: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Approval>>(`/approvals${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<Approval>>(`/approvals/${id}`),
    approve: (id: string, remarks?: string) =>
      apiPost<Envelope<{ approval: Approval; purchaseOrder?: PurchaseOrder; invoice?: Invoice }>>(`/approvals/${id}/approve`, { remarks }),
    reject: (id: string, remarks: string) => apiPost<Envelope<Approval>>(`/approvals/${id}/reject`, { remarks }),
  },
  purchaseOrders: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<PurchaseOrder>>(`/purchase-orders${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<PurchaseOrder>>(`/purchase-orders/${id}`),
    markSent: (id: string, note?: string) => apiPost<Envelope<PurchaseOrder>>(`/purchase-orders/${id}/sent`, { note }),
    markDelivered: (id: string, note?: string) => apiPost<Envelope<PurchaseOrder>>(`/purchase-orders/${id}/delivered`, { note }),
  },
  invoices: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Invoice>>(`/invoices${buildQuery(q)}`),
    get: (id: string) => apiGet<Envelope<Invoice>>(`/invoices/${id}`),
    markPaid: (id: string, payment: { amount: number; method: string; reference?: string; notes?: string }) =>
      apiPost<Envelope<Invoice>>(`/invoices/${id}/pay`, { payment }),
    sendEmail: (id: string) => apiPost<Envelope<{ ok: true }>>(`/invoices/${id}/email`, {}),
  },
  notifications: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<Notification>>(`/notifications${buildQuery(q)}`),
    unreadCount: () => apiGet<Envelope<{ count: number }>>('/notifications/unread-count'),
    markRead: (ids: string[]) => apiPost<Envelope<{ updated: number }>>('/notifications/mark-read', { ids }),
    markAllRead: () => apiPost<Envelope<{ updated: number }>>('/notifications/mark-all-read', {}),
  },
  audit: {
    list: (q: Record<string, unknown> = {}) => apiGet<Paginated<AuditLog>>(`/audit-logs${buildQuery(q)}`),
    exportCsvUrl: (q: Record<string, unknown> = {}) => `/audit-logs/export.csv${buildQuery(q)}`,
  },
  reports: {
    dashboard: () => apiGet<Envelope<DashboardPayload>>('/reports/dashboard'),
    spendByVendor: (q: Record<string, unknown> = {}) => apiGet<Envelope<SpendByVendorRow[]>>(`/reports/spend-by-vendor${buildQuery(q)}`),
    monthlyTrend: (q: Record<string, unknown> = {}) => apiGet<Envelope<MonthlyTrendPoint[]>>(`/reports/monthly-trend${buildQuery(q)}`),
    vendorPerformance: (q: Record<string, unknown> = {}) => apiGet<Envelope<VendorPerformanceRow[]>>(`/reports/vendor-performance${buildQuery(q)}`),
  },
};

export function pdfUrl(kind: 'purchase-order' | 'invoice', id: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/api\/v1$/, '');
  return `${base}/api/v1/${kind === 'purchase-order' ? 'purchase-orders' : 'invoices'}/${id}/pdf`;
}

export function csvUrl(path: string, params: Record<string, unknown> = {}): string {
  const base = process.env.NEXT_PUBLIC_API_URL || '';
  return `${base}${path}${buildQuery(params)}`;
}
