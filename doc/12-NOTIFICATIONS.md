# 12 — Notifications

The current version of VendorBridge uses **database-based in-app notifications only**. Email, SMS, push, and webhooks are future integrations and must remain optional and loosely coupled.

## 12.1 Goals

1. **Inform users** about procurement events relevant to them.
2. **Never block business operations** — a failed notification must not roll back a successful state change.
3. **Be loosely coupled** — swapping the notification mechanism (in-app → email → SMS → push) must not require changes to business services.

## 12.2 Notification types

| Type | Recipient(s) | Trigger |
|------|---------------|---------|
| `RFQ_PUBLISHED` | All vendors assigned to the RFQ | Officer publishes an RFQ |
| `QUOTATION_SUBMITTED` | Procurement officers (all) | Vendor submits a quotation |
| `APPROVAL_REQUESTED` | All managers | Officer shortlists a quotation |
| `APPROVAL_APPROVED` | Officer who shortlisted, vendor, admin | Manager approves |
| `APPROVAL_REJECTED` | Officer who shortlisted | Manager rejects (with remarks) |
| `PO_GENERATED` | Officer, vendor, admin | Auto on approval |
| `PO_SENT` | Vendor | Officer marks PO sent |
| `PO_DELIVERED` | Officer, admin | Vendor or officer marks delivered |
| `INVOICE_GENERATED` | Officer, vendor, admin | Auto on PO |
| `INVOICE_PAID` | Officer, vendor, admin | Officer marks paid |
| `INVOICE_OVERDUE` | Officer, admin | System marks overdue |

The vendor recipient is the **primary contact** of the VendorCompany in v1 (the first user linked to the company). All vendor users of that company see the notification.

## 12.3 Schema

See [07-DATA-MODEL.md](07-DATA-MODEL.md) §7.2 Notification.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → User (recipient) |
| type | enum | from the catalog above |
| title | text | short, human-readable |
| body | text | |
| link | text | e.g., `/rfq/abc-123` (frontend route) |
| readAt | timestamptz | null if unread |
| createdAt | timestamptz | |

Indexes: `(userId, readAt)`, `createdAt`.

## 12.4 How to emit

A notification is created via `NotificationService.emit()`:

```ts
await this.notifications.emit({
  type: 'RFQ_PUBLISHED',
  recipientUserIds: vendorUserIds,
  title: `New RFQ: ${rfq.title}`,
  body: `Deadline: ${rfq.deadline.toISOString()}`,
  link: `/vendor-portal/rfqs/${rfq.id}`,
  tx, // optional: same transaction as the business event
});
```

The `tx` argument is the Prisma transaction client. When provided, the notification row is part of the same transaction. If omitted, the notification is written in its own transaction.

**Critical rule:** `NotificationService.emit()` never throws. If the DB write fails, it logs the error and returns. Business code continues.

## 12.5 Read flow

- Endpoint: `GET /api/v1/notifications?unread=true&page=1&pageSize=20`
- Response: paginated list, newest first.
- `POST /api/v1/notifications/:id/read` marks one as read.
- `POST /api/v1/notifications/read-all` marks all as read.
- Frontend polls every 30s when the user is active (TanStack Query refetch on focus).

## 12.6 In-app delivery

- Frontend shows a bell icon in the topbar with a badge for unread count.
- Clicking the bell opens a dropdown with the 20 most recent notifications.
- Clicking a notification navigates to its `link` and marks it as read.
- "Mark all as read" button in the dropdown.

## 12.7 Email and other channels (future)

The notification module is designed to be channel-agnostic. The internal `NotificationService.emit()` writes to the `notifications` table. A separate `NotificationDispatcher` is responsible for delivering to other channels:

```
Business Event
    ↓
NotificationService.emit()  ← writes to DB, in-transaction
    ↓
NotificationDispatcher.dispatch()  ← reads pending, sends to channels
    ↓
[Email] [SMS] [Push] [Webhook]
```

The dispatcher runs:

- **In-process** for v1 (a simple post-commit hook).
- **As a job** in v2 (BullMQ + Redis, or similar).
- **As a separate worker** in v3.

Email integration is pluggable:

- v1.1: SendGrid or AWS SES via `@sendgrid/mail` or `nodemailer`.
- v2: a `EmailProvider` interface with multiple implementations.

The contract:

```ts
interface NotificationChannel {
  send(notification: Notification): Promise<{ success: boolean; error?: string }>;
}
```

Multiple channels can be registered. Failures in one channel do not affect others.

## 12.8 Failure handling

- **DB write fails** → log, continue. Business operation succeeds; the user simply does not see the in-app notification.
- **Email send fails** → log, retry with exponential backoff (3 attempts), then mark as `email_failed` in a future `notification_deliveries` table.
- **SMTP is down** → notifications queue up; dispatcher retries when SMTP is back.
- **User is offline** → notifications remain unread; they see them on next page load.

## 12.9 User preferences (future)

- v1: all users receive all notification types for events they're involved in.
- v2: per-user preferences (e.g., "don't email me for INVOICE_OVERDUE").

For the hackathon, preferences are out of scope.

## 12.10 What is NOT in notifications

- Marketing emails.
- Password reset emails are handled separately by the auth flow (see [modules/M01-AUTH.md](modules/M01-AUTH.md)).
- Real-time push (WebSockets) is not in v1.
- SMS is not in v1.
