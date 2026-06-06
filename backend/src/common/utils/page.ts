import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/page';

export interface PageRequest {
  page?: number | string;
  pageSize?: number | string;
}

export interface Page<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function normalizePage(input?: PageRequest): { page: number; pageSize: number; skip: number; take: number } {
  const rawPage = Number(input?.page ?? DEFAULT_PAGE);
  const rawSize = Number(input?.pageSize ?? DEFAULT_PAGE_SIZE);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : DEFAULT_PAGE;
  const size = Number.isFinite(rawSize) && rawSize > 0 ? Math.min(MAX_PAGE_SIZE, Math.floor(rawSize)) : DEFAULT_PAGE_SIZE;
  return { page, pageSize: size, skip: (page - 1) * size, take: size };
}

export function buildPage<T>(data: T[], total: number, page: number, pageSize: number): Page<T> {
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
