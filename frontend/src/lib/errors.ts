import type { ApiError } from './types';

const CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Some fields need attention.',
  UNAUTHORIZED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'This action conflicts with the current state.',
  BUSINESS_RULE: 'This action is not allowed at the current workflow state.',
  DEADLINE_PASSED: 'The deadline has passed. This action is no longer available.',
  INVALID_STATE_TRANSITION: 'Invalid state transition.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
  RATE_LIMITED: 'Too many requests. Please slow down.',
  BAD_REQUEST: 'Invalid request.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to too many failed attempts.',
  VENDOR_NOT_VERIFIED: 'Vendor account is pending verification.',
  RFQ_HAS_NO_VENDORS: 'RFQ must have at least one vendor before publishing.',
  RFQ_DEADLINE_INVALID: 'RFQ deadline must be in the future.',
  QUOTATION_AFTER_DEADLINE: 'Cannot submit quotation after the deadline.',
  QUOTATION_LOCKED: 'Quotation can no longer be edited.',
  APPROVAL_SELF_CONFLICT: 'You cannot approve a quotation you shortlisted.',
  APPROVAL_ALREADY_DECIDED: 'This approval has already been decided.',
  PO_NOT_FOUND: 'Purchase order not found.',
  INVOICE_ALREADY_PAID: 'Invoice has already been paid.',
  INVOICE_OVERDUE: 'Invoice is overdue.',
  FILE_TOO_LARGE: 'File exceeds the maximum allowed size.',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type.',
};

export function humanizeError(err: ApiError | { code?: string; message?: string } | null | undefined): string {
  if (!err) return 'Unexpected error.';
  const code = err.code || '';
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (err.message) return err.message;
  return 'Unexpected error.';
}

export function getFieldErrors(details: Record<string, unknown> | undefined): Record<string, string> {
  if (!details || typeof details !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details)) {
    if (Array.isArray(v) && v.length && typeof v[0] === 'string') out[k] = v[0];
    else if (typeof v === 'string') out[k] = v;
  }
  return out;
}
