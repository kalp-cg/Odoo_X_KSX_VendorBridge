# M11 — Reports & Analytics

> Source of truth for the Reports screen. See [10-BUSINESS-RULES.md](../01-product/10-BUSINESS-RULES.md) §10.9 and the dashboard data flow in [04-ARCHITECTURE.md](../02-architecture/04-ARCHITECTURE.md) §4.9.

## M11.1 Purpose

- Provide procurement insights: vendor performance, spend, monthly trends.
- Derive all metrics from live operational data (no duplicated analytics storage in v1).
- Support date-range filtering and export to CSV/PDF.
- Enforce ownership: vendors see only their own data.

## M11.2 Scope

**In scope**:
- Vendor performance report (rating, on-time delivery %, win rate, average price).
- Spend report (total spend, by vendor, by category, by month).
- Monthly procurement trend (count of POs, total spend, by month).
- Date range filters.
- Export to CSV.
- Dashboard summary cards.

**Out of scope**:
- Real-time BI dashboards with sub-second latency (v1 reports are computed on read).
- Predictive analytics / forecasting.
- Custom report builder.
- Cross-tenant / cross-org comparisons (single org).
- Email scheduled reports.

## M11.3 Data sources

Reports derive from:

- `rfqs`
- `quotations`
- `purchase_orders` + `po_line_items`
- `invoices`
- `vendor_companies` (for vendor name, category, rating)

No materialized views or analytics tables in v1. The service uses Prisma `groupBy`, `_count`, `_sum`, and `aggregate` for computations. For larger datasets, we add DB indexes (already in [07-DATA-MODEL.md](../02-architecture/07-DATA-MODEL.md)).

## M11.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/reports/dashboard` | any auth (vendor scoped) | Summary cards: pending approvals (officer/manager), active RFQs, recent POs, recent invoices, MTD spend, open invoices, overdue invoices, vendor count. |
| GET | `/api/v1/reports/vendor-performance` | ADMIN, OFFICER, MANAGER; VENDOR (own only) | Per-vendor metrics |
| GET | `/api/v1/reports/spend` | ADMIN, OFFICER, MANAGER | Spend by vendor / category / month |
| GET | `/api/v1/reports/monthly-trend` | ADMIN, OFFICER, MANAGER | Time series |
| GET | `/api/v1/reports/export` | ADMIN, OFFICER, MANAGER | CSV export of the above |
| GET | `/api/v1/reports/vendor/:vendorId` | ADMIN, OFFICER, MANAGER; VENDOR (own) | Per-vendor detail |

### Query parameters

- `?from=YYYY-MM-DD&to=YYYY-MM-DD` (required for trend and spend).
- `?groupBy=vendor|category|month` (spend report).
- `?status=...` (filter by status, e.g., `PAID` invoices only).
- `?vendorId=...` (filter to a single vendor; ignored for vendor users).

## M11.5 Service layer

```
reports/
├── reports.module.ts
├── controllers/
│   └── reports.controller.ts
├── services/
│   ├── dashboard.service.ts
│   ├── vendor-performance.service.ts
│   ├── spend.service.ts
│   ├── monthly-trend.service.ts
│   └── export.service.ts
├── repositories/
│   └── reports.repository.ts          # complex queries, groupBy
├── dto/
│   ├── spend-report.dto.ts
│   ├── vendor-performance.dto.ts
│   ├── monthly-trend.dto.ts
│   ├── dashboard.dto.ts
│   └── export.dto.ts
└── tests/
```

## M11.6 Vendor performance metrics

For each vendor, computed:

- `totalQuotations`: count of quotations submitted.
- `acceptedQuotations`: count with status `ACCEPTED`.
- `rejectedQuotations`: count with status `REJECTED`.
- `winRate`: `acceptedQuotations / totalQuotations` (0 if no quotations).
- `totalPoValue`: sum of `purchase_orders.total_amount` where vendor = X and status != CANCELLED (none in v1, so all).
- `totalInvoiceValue`: sum of `invoices.total_amount` where vendor = X.
- `paidInvoiceValue`: sum where status = PAID.
- `overdueInvoiceCount`: count where status = OVERDUE.
- `onTimeDeliveryRate`: % of POs that reached `DELIVERED` status (i.e., denominator = count of POs with status = DELIVERED, numerator = count where `deliveredAt <= estimatedDeliveryDate` from the quotation). Note: v1 has no separate "delivery date" on the PO; we use the quotation's `estimatedDeliveryDate` as the agreed date. (This is approximate; v1.1 will add a PO-level delivery date field.)
- `rating`: a computed 0–5 score. v1 formula:
  - Start at 3.0.
  - +1.0 if `winRate > 0.5` and at least 3 quotations.
  - +0.5 if `onTimeDeliveryRate > 0.8` and at least 3 POs.
  - -0.5 if `overdueInvoiceCount > 0` and `paidInvoiceCount + overdueInvoiceCount > 0` and overdue ratio > 0.5.
  - Clamp to [0, 5].
  - Stored on `vendor_companies.rating` (updated by a daily job) OR computed on read (v1 default: computed on read).

We compute on read for correctness. A nightly job updates the stored `rating` for fast list rendering.

## M11.7 Spend report

```ts
type SpendByVendor = {
  vendorId: string;
  vendorName: string;
  totalSpend: number;       // sum of paid + pending invoices in range
  poCount: number;
  invoiceCount: number;
};

type SpendByCategory = {
  category: string;
  totalSpend: number;
  poCount: number;
};

type SpendByMonth = {
  month: string;            // 'YYYY-MM'
  totalSpend: number;
  poCount: number;
};
```

Spend = sum of `invoices.total_amount` (regardless of status, by default). The user can filter `?status=PAID` to see only paid.

## M11.8 Monthly trend

Time series, monthly buckets:

```ts
type MonthlyTrendPoint = {
  month: string;            // 'YYYY-MM'
  rfqCount: number;
  quotationCount: number;
  poCount: number;
  invoiceCount: number;
  totalSpend: number;       // sum of invoice total_amount
};
```

Computed with Prisma `groupBy` on `date_trunc('month', created_at)`.

## M11.9 Dashboard cards

The dashboard service returns a single object with:

```ts
type DashboardData = {
  // Counts
  pendingApprovalsCount: number;       // officer/manager only
  activeRfqsCount: number;              // PUBLISHED, deadline in future
  openInvoicesCount: number;            // PENDING or OVERDUE
  overdueInvoicesCount: number;
  vendorCount: number;                  // ACTIVE vendors
  // Sums
  monthToDateSpend: number;             // sum of invoice total_amount in current month
  // Recent
  recentPos: PurchaseOrderSummary[];     // last 5
  recentInvoices: InvoiceSummary[];      // last 5
  // Quick actions (role-derived on the frontend)
  roleHints: {
    canCreateRfq: boolean;
    canReviewApprovals: boolean;
    canManageVendors: boolean;
  };
};
```

Vendor users get a slimmer dashboard:

```ts
type VendorDashboardData = {
  openRfqsCount: number;            // PUBLISHED + assigned + before deadline + not yet quoted
  pendingInvoicesCount: number;
  recentInvoices: InvoiceSummary[];  // own last 5
  recentPos: PurchaseOrderSummary[]; // own last 5
};
```

## M11.10 Export

`GET /api/v1/reports/export?type=vendor-performance&from=...&to=...&format=csv|pdf` returns:

- `csv`: a CSV file of the rows.
- `pdf`: a server-rendered PDF (using `@react-pdf/renderer`) with a tabular layout and a header (VendorBridge logo, report title, date range).

PDF generation runs server-side and is best-effort. CSV is always available.

## M11.11 Performance

- All aggregation queries are bounded by the date range filter.
- We use `groupBy` and `aggregate` to push work to the DB.
- For larger datasets, an in-memory cache (Node `Map` per request, or future Redis) avoids re-computing the same report within a request.
- Heavy reports (e.g., 5-year trends) are paginated or sampled. We do not pre-aggregate in v1.

## M11.12 Audit events

The reports module does not emit audit events for read operations (per [11-AUDIT-LOGS.md](../03-platform/11-AUDIT-LOGS.md) §11.7). The nightly `rating` job emits `VENDOR_RATING_UPDATED` per vendor.

## M11.13 Notifications

None.

## M11.14 Edge cases

| Scenario | Behavior |
|----------|----------|
| No data in range | Returns empty arrays with 0 counts. UI shows "No data for the selected range" message. |
| Date range > 5 years | Allowed; may be slow. UI warns. |
| Vendor with 0 quotations | Win rate = 0; rating = 3.0 baseline. |
| Concurrent rating update jobs | DB lock or `INSERT ... ON CONFLICT DO UPDATE` ensures only one row per vendor. |
| PDF export fails (e.g., font issue) | 500 with a clear error. CSV export still works. |
| Vendor tries to access spend report (all vendors) | 403 `PERMISSION_DENIED` |
| Vendor accesses vendor-performance with `?vendorId=other` | 403 `OWNERSHIP_DENIED` |
| Time zone in date range | All dates are stored as `timestamptz`. Date range filters use server UTC. UI lets the user pick a TZ; conversion happens on the client. |
| Division by zero (e.g., win rate with 0 quotations) | Returns 0, never NaN. |
| Negative spend (e.g., credit notes in v2) | Not possible in v1 (no credit notes). |

## M11.15 Future (not in v1)

- Materialized views for hot reports.
- Pre-aggregated `vendor_metrics` table updated by a job.
- Custom report builder.
- Forecast / trend prediction.
- Email scheduled reports.
- Anomaly detection (spend spikes, vendor outliers).
- Saved views per user.
