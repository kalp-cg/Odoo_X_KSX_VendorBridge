# 15 — Design System

VendorBridge uses **shadcn/ui** as the primary component library. This document codifies how we use it, theme it, and extend it.

## 15.1 Why shadcn/ui

- **Owned source, not a black box.** Components live in our repo. We can edit them.
- **Radix-based primitives.** Accessibility and behavior are battle-tested.
- **Tailwind-native.** No runtime CSS-in-JS, easy to audit.
- **Composable.** Each component is small and predictable.
- **AI-friendly.** The generated code is plain React + Tailwind — easy for AI tools to read and modify.

## 15.2 Setup

- shadcn/ui is initialized with the default New York style and the neutral base color.
- Generated components live in `apps/web/components/ui/`.
- The `components.json` config is committed.
- Icons via `lucide-react`.

```bash
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input dialog sheet card ...
```

## 15.3 Preferred components

The problem statement and Screens doc reference these explicitly. Use them.

| Component | Use |
|-----------|-----|
| `Button` | All buttons. Variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`. |
| `Input`, `Textarea` | All text inputs. |
| `Select` | All single-select dropdowns. |
| `Combobox` | Vendor selection, search-with-pick. |
| `Checkbox`, `RadioGroup` | Boolean and exclusive-choice inputs. |
| `Switch` | Settings toggles. |
| `Dialog` | Confirmations and short forms. |
| `Sheet` | Side panels for detail views. |
| `Card` | Container for grouped content (dashboard widgets, comparison rows). |
| `Tabs` | Tabbed views (e.g., invoice detail with PDF / History tabs). |
| `Table` (TanStack wrapped) | All data tables. |
| `Badge` | Status indicators. |
| `DropdownMenu` | Row actions in tables. |
| `Toast` (sonner) | Transient feedback. |
| `Form` (RHF integrated) | Form scaffolding. |
| `Skeleton` | Loading states. |
| `Avatar` | User/vendor logos. |
| `Tooltip` | Inline help. |
| `Alert` | Inline errors and warnings (e.g., "deadline passed" banner). |
| `Command` (cmdk) | Quick search / command palette. |

## 15.4 Status badges — single source of truth

Status badges are everywhere. Define them once in `components/ui/status-badge.tsx`:

```ts
type Status =
  | 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED'           // RFQ
  | 'SUBMITTED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED'    // Quotation
  | 'PENDING' | 'APPROVED'                                  // Approval
  | 'GENERATED' | 'SENT' | 'DELIVERED'                      // PO
  | 'PENDING' | 'PAID' | 'OVERDUE'                          // Invoice
  | 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED' // Vendor
  | 'INACTIVE' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';    // User

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  DRAFT: 'secondary',
  PUBLISHED: 'default',
  CLOSED: 'outline',
  CANCELLED: 'destructive',
  // ...
};
```

Always include the text label. Color is a secondary signal.

## 15.5 Tables

We do not use shadcn's plain `Table` for large data sets. Instead:

- `components/tables/data-table.tsx` wraps **TanStack Table** with shadcn/ui styling.
- Supports: sorting, filtering, pagination, row selection, column visibility.
- Filters live in a sticky filter bar above the table.
- Pagination is at the bottom; "X–Y of Z" indicator.
- Empty state: friendly illustration + CTA.
- Loading state: skeleton rows.

## 15.6 Forms

- Use shadcn's `Form` component (RHF-integrated).
- All form fields are stacked vertically by default; horizontal on wide screens.
- Required fields have a small `*` after the label.
- Error message appears below the field with `aria-describedby` link.
- Submit button is full-width on mobile, right-aligned on desktop.
- Cancel button is left of submit.

## 15.7 Dialogs and confirmations

- Use `Dialog` for confirmations on destructive or irreversible actions (cancel RFQ, mark paid).
- Confirmation copy must be unambiguous: "Cancel this RFQ? Vendors will be auto-rejected."
- For high-risk actions, type-to-confirm is recommended (e.g., type the PO number).

## 15.8 Theme

- Light + dark mode, default light, follow system preference.
- Implemented with `next-themes` + CSS variables in `styles/globals.css`.
- Tokens (spacing, colors, radius) follow shadcn defaults. Override only with explicit reason.
- All colors must pass WCAG AA against their background.

## 15.9 Spacing and layout

- 8px grid. All margins and paddings are multiples of 4.
- Page max-width: 1440px. Centered.
- Sidebar width: 256px desktop, full-screen drawer on mobile.
- Content padding: 24px desktop, 16px mobile.

## 15.10 Typography

- Font: Inter (variable) via `next/font/google`.
- Base: 14px / 1.5.
- Headings: `text-2xl font-semibold` for page titles, `text-lg font-medium` for sections.
- Monospace (for IDs like PO numbers): `font-mono`.

## 15.11 Icons

- `lucide-react`. No icon font.
- Icon size: 16px inline with text, 20px in buttons, 24px in standalone.
- Always pair with a `sr-only` label when icon-only.

## 15.12 Loading and empty states

- **Loading**: skeleton placeholder (shimmer).
- **Empty**: illustration + headline + CTA.
- **Error**: icon + headline + retry button (where applicable).

## 15.13 Forbidden patterns

- ❌ No custom CSS files (Tailwind utilities only).
- ❌ No inline `style={{ ... }}` in components (except for shadcn-generated files).
- ❌ No emoji in production UI.
- ❌ No color-only status indicators.
- ❌ No more than 2 typefaces (Inter + monospace is the limit).
- ❌ No reinventing components shadcn already provides.

## 15.14 Updating shadcn

- New components added via the CLI.
- Breaking changes from upstream require an ADR and migration of all usage sites.
- We commit the generated code; we do not pin to a remote registry.
