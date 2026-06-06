# 14 — Frontend Architecture

The frontend is a **Next.js 15** application using the App Router. It serves three audiences via route groups: public (auth), internal (officers/managers/admins), and vendor (vendor portal).

## 14.1 Goals

- **Type safety end-to-end** — Zod schemas shared with the backend.
- **Fast, predictable UX** — TanStack Query for server state, optimistic updates where safe.
- **Mobile-first** — every screen is responsive.
- **Accessible** — keyboard-navigable, screen-reader-friendly, WCAG AA contrast.
- **AI-friendly** — explicit, well-named files and components.

## 14.2 Tech stack (recap)

See [05-TECH-STACK.md](05-TECH-STACK.md) §5.1.

## 14.3 Routing strategy

Route groups in `app/`:

```
app/
├── (auth)/                    # Public — login, signup, forgot-password
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── forgot-password/page.tsx
├── (internal)/                # Officer / Manager / Admin
│   ├── layout.tsx             # role-aware nav
│   ├── dashboard/page.tsx
│   ├── vendors/...
│   ├── rfq/...
│   ├── approvals/...
│   ├── purchase-orders/...
│   ├── invoices/...
│   ├── activity/page.tsx
│   └── reports/page.tsx
├── (vendor)/                  # Vendor portal
│   ├── layout.tsx
│   ├── dashboard/page.tsx
│   ├── rfqs/...
│   ├── purchase-orders/...
│   └── activity/page.tsx
├── api/                       # BFF endpoints (rare)
└── layout.tsx                 # root layout: providers, theme
```

The `(internal)` and `(vendor)` groups are **mutually exclusive** based on the user's role. A user with role `VENDOR` cannot access any `(internal)` route, and vice versa. Enforced by `middleware.ts`.

## 14.4 Middleware

```ts
// middleware.ts (sketch)
export function middleware(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value;
  // ... verify or refresh
  // ... attach user to request
  // ... enforce role-based access for the route group
}
```

`middleware.ts` runs on the Edge runtime and handles:

- Session check (token presence + verification).
- Role-based route guard.
- Redirect to login if unauthenticated.
- Redirect to the correct portal if accessing the wrong one.

## 14.5 Data fetching

- **Server components** for static, role-agnostic content (landing, login).
- **TanStack Query** (`@tanstack/react-query`) for all dynamic data.
- **Server actions** for simple mutations (e.g., mark notification read). For complex mutations with business logic, prefer the API call so behavior is consistent with mobile (future) and other clients.

Pattern:

```tsx
'use client';
function RfqList() {
  const { data, isLoading } = useQuery({
    queryKey: ['rfqs', filters],
    queryFn: () => api.rfq.list(filters),
  });
  // ...
}
```

Mutations use `useMutation` with optimistic updates where safe (mark-as-read) and `invalidateQueries` after server confirmation for state-changing ops.

## 14.6 Forms

- **React Hook Form** for state, **Zod** for validation.
- Schemas live in `packages/shared/src/schemas/` and are imported by both frontend and backend.
- Form components live in `components/forms/` and wrap shadcn/ui inputs.
- Server errors are mapped to form fields via `setError` on the RHF instance.

```tsx
const form = useForm<CreateRfqInput>({
  resolver: zodResolver(createRfqSchema),
  defaultValues: { ... },
});
```

## 14.7 Component organization

```
components/
├── ui/                        # shadcn/ui generated (Button, Input, Dialog, etc.)
├── forms/                     # RHF-wrapped form atoms
├── tables/                    # DataTable, FilterBar, Pagination
├── layouts/                   # AppShell, Sidebar, Topbar
└── feature/
    ├── rfq/
    │   ├── rfq-form.tsx
    │   ├── rfq-list.tsx
    │   ├── rfq-card.tsx
    │   └── rfq-status-badge.tsx
    ├── quotation/
    ├── approval/
    ├── invoice/
    └── ...
```

Feature components are **smart** — they fetch data and handle state. UI primitives in `components/ui` are **dumb** — they receive props and render.

## 14.8 State management

- **Server state**: TanStack Query.
- **URL state**: `useSearchParams` + `nuqs` for typed search params.
- **Form state**: React Hook Form.
- **Ephemeral UI state** (modals, side-panel toggles): Zustand or local component state.
- **Auth state**: a `useAuth` hook backed by `/auth/me` and TanStack Query.

No Redux. No MobX.

## 14.9 Styling

- **Tailwind** for utility styling.
- **shadcn/ui** for primitives.
- **CSS variables** for theme tokens (defined in `styles/globals.css`).
- **Light + dark** theme support via `next-themes`.
- **No inline styles** in components (allowed only in shadcn-generated files).

## 14.10 Error handling

- **Route-level error boundary**: `app/<route>/error.tsx` for page-level errors.
- **Global error boundary**: `app/global-error.tsx` for the root layout.
- **API errors**: parsed in the API client into a typed `ApiError` with `code`, `message`, `fieldErrors`. UI shows toast (sonner) for global errors and inline form errors for validation.
- **Loading states**: skeleton loaders (shadcn/ui `Skeleton`) for tables and cards.
- **Empty states**: friendly CTA in every list/table.

## 14.11 Accessibility

- All interactive elements are keyboard-reachable.
- shadcn/ui primitives are Radix-based and ship with ARIA attributes.
- Form fields use `aria-describedby` for errors.
- Modals trap focus and restore on close.
- Color is never the only indicator (status badges always include text).
- Color contrast meets WCAG AA.

## 14.12 Performance

- **Code splitting**: route-level via App Router; component-level via `dynamic()` for heavy widgets (charts, PDF viewer).
- **Image optimization**: `next/image` with Cloudinary loader.
- **Font optimization**: `next/font` with display swap.
- **Prefetch**: Next.js prefetches linked routes; we tune with `prefetch={false}` on heavy routes.
- **Memoization**: `useMemo`/`useCallback` only when there's a real perf issue — premature optimization is forbidden.
- **Bundle analysis**: `@next/bundle-analyzer` in CI to catch regressions.

## 14.13 Internationalization (future)

- v1: English only.
- v2: `next-intl` for i18n. The string-extraction discipline starts in v1 (no concatenated strings in components; use a `t()` helper that wraps a passthrough).

## 14.14 Testing

- **Unit**: Vitest (or Jest) for hooks and pure components.
- **Component**: React Testing Library.
- **E2E (optional in v1, recommended in v2)**: Playwright.
- Coverage target: 70% for critical flows (auth, RFQ, approval, invoice).

## 14.15 Print and PDF

- **Print**: use the browser's `window.print()` for the invoice screen. CSS `@media print` hides the sidebar and topbar.
- **PDF**: server-rendered with `@react-pdf/renderer` (or `pdfkit` on the backend) at `GET /api/v1/invoices/:id/pdf`. Returns a PDF blob.

## 14.16 Charts (Reports)

- Recharts is the default. Bar, line, and pie charts for the required reports.
- Charts are responsive and have an `aria-label` summary.
