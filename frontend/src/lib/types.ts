export type UserRole = 'ADMIN' | 'OFFICER' | 'MANAGER' | 'VENDOR';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';

export type VendorStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export type RfqStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
export type RfqVendorStatus = 'INVITED' | 'RESPONDED' | 'DECLINED' | 'WITHDRAWN';

export type QuotationStatus = 'SUBMITTED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type PoStatus = 'GENERATED' | 'SENT' | 'DELIVERED';

export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE';

export type NotificationStatus = 'UNREAD' | 'READ' | 'ARCHIVED';
export type NotificationType =
  | 'RFQ_PUBLISHED'
  | 'RFQ_CLOSED'
  | 'QUOTATION_SUBMITTED'
  | 'QUOTATION_SHORTLISTED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'PO_GENERATED'
  | 'PO_SENT'
  | 'PO_DELIVERED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PAID'
  | 'INVOICE_OVERDUE'
  | 'VENDOR_VERIFIED'
  | 'VENDOR_BLOCKED'
  | 'SYSTEM';

export type AuditAction =
  | 'USER_SIGNUP'
  | 'USER_LOGIN'
  | 'USER_LOGIN_FAILED'
  | 'USER_LOGOUT'
  | 'USER_LOCKED'
  | 'USER_UPDATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_STATUS_CHANGED'
  | 'VENDOR_CREATED'
  | 'VENDOR_UPDATED'
  | 'VENDOR_STATUS_CHANGED'
  | 'RFQ_CREATED'
  | 'RFQ_UPDATED'
  | 'RFQ_PUBLISHED'
  | 'RFQ_CLOSED'
  | 'RFQ_CANCELLED'
  | 'QUOTATION_SUBMITTED'
  | 'QUOTATION_UPDATED'
  | 'QUOTATION_SHORTLISTED'
  | 'QUOTATION_REJECTED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  | 'PO_GENERATED'
  | 'PO_SENT'
  | 'PO_DELIVERED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PAID'
  | 'INVOICE_OVERDUE'
  | 'INVOICE_EMAIL_SENT'
  | 'REPORT_EXPORTED'
  | 'FILE_UPLOADED'
  | 'FILE_DELETED';

export type AuditEntityType =
  | 'USER'
  | 'VENDOR'
  | 'RFQ'
  | 'QUOTATION'
  | 'APPROVAL'
  | 'PURCHASE_ORDER'
  | 'INVOICE'
  | 'NOTIFICATION'
  | 'AUDIT_LOG'
  | 'FILE'
  | 'AUTH'
  | 'REPORT';

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorBody {
  error?: ApiError;
  path?: string;
  method?: string;
  timestamp?: string;
  requestId?: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string | null;
  vendorCompanyId?: string | null;
  lastLoginAt?: string | null;
  emailVerifiedAt?: string | null;
  createdAt?: string;
}

export interface Vendor {
  id: string;
  legalName: string;
  displayName: string;
  gstNumber?: string | null;
  panNumber?: string | null;
  registrationNo?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  category?: string | null;
  status: VendorStatus;
  rating?: number | null;
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RfqLineItem {
  id: string;
  rfqId: string;
  lineNo: number;
  description: string;
  quantity: number | string;
  unit: string;
  targetUnitPrice?: number | string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface RfqVendorInfo {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName?: string;
  status: RfqVendorStatus;
  invitedAt: string;
  respondedAt?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
}

export interface Rfq {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  status: RfqStatus;
  deadline: string;
  publishedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  lineItems?: RfqLineItem[];
  vendors?: RfqVendorInfo[];
  quotationCount?: number;
}

export interface QuotationLineItem {
  id: string;
  quotationId?: string;
  lineNo: number;
  description: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
  lineTotal?: number | string;
  notes?: string | null;
}

export interface Quotation {
  id: string;
  number: string;
  rfqId: string;
  rfqNumber?: string;
  rfqTitle?: string;
  vendorId: string;
  vendorName?: string;
  status: QuotationStatus;
  totalAmount: number | string;
  deliveryDate?: string | null;
  notes?: string | null;
  isLocked: boolean;
  submittedAt: string;
  updatedAt: string;
  submittedById?: string;
  submittedByName?: string;
  lineItems?: QuotationLineItem[];
}

export interface Approval {
  id: string;
  rfqId: string;
  rfqNumber?: string;
  rfqTitle?: string;
  quotationId: string;
  quotationNumber?: string;
  quotationTotal?: number | string;
  status: ApprovalStatus;
  remarks?: string | null;
  requestedById: string;
  requestedByName?: string;
  actedById?: string | null;
  actedByName?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  purchaseOrderId?: string | null;
  invoiceId?: string | null;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  approvalId: string;
  vendorId: string;
  vendorName?: string;
  quotationId: string;
  status: PoStatus;
  totalAmount: number | string;
  taxRatePercent: number | string;
  taxAmount: number | string;
  grandTotal: number | string;
  currency: string;
  notes?: string | null;
  generatedAt: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  updatedAt: string;
  lineItems?: QuotationLineItem[];
  invoiceId?: string | null;
}

export interface Invoice {
  id: string;
  number: string;
  purchaseOrderId: string;
  purchaseOrderNumber?: string;
  approvalId: string;
  vendorId: string;
  vendorName?: string;
  status: InvoiceStatus;
  subtotal: number | string;
  taxRatePercent: number | string;
  taxAmount: number | string;
  grandTotal: number | string;
  currency: string;
  issueDate: string;
  dueDate: string;
  paidAt?: string | null;
  overdueAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface AuditActorRef {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuditLog {
  id: string | number;
  occurredAt: string;
  actorId?: string | null;
  actor?: AuditActorRef | null;
  actorEmail?: string | null;
  action: AuditAction | string;
  entityType: AuditEntityType | string;
  entityId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface DashboardCounts {
  openRfq: number;
  openPo: number;
  pendingInvoices: number;
  overdueInvoices: number;
  vendorCount: number;
  mtdSpend: number;
}

export interface DashboardPayload {
  counts: DashboardCounts;
  recent: {
    purchaseOrders: PurchaseOrder[];
    invoices: Invoice[];
  };
}

export interface SpendByVendorRow {
  vendor: { id: string; displayName: string; legalName?: string };
  totalSpend: number;
  invoiceCount: number;
}

export interface MonthlyTrendPoint {
  month: string | Date;
  total: number;
  count: number;
}

export interface VendorPerformanceRow {
  vendor: { id: string; displayName: string };
  total: number;
  count: number;
  delivered: number;
  onTimeDeliveryRate: number;
}
