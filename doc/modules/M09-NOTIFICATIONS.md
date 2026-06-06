# M09 — Notifications

> Implementation of the in-app notification system. See [12-NOTIFICATIONS.md](../12-NOTIFICATIONS.md) for the system design and contract.

## M09.1 Purpose

- Persist in-app notifications for users.
- Provide a read/unread API.
- Provide a pluggable dispatcher for future channels (email, SMS, push, webhooks).
- Never block business operations.

## M09.2 Scope

**In scope**:
- Persist `Notification` rows in the DB.
- In-app delivery via API + frontend bell icon.
- Mark as read (single, all).
- Pluggable channel interface.
- v1 default channel: in-app (DB row).

## M09.3 Entities

- `Notification` (see [07-DATA-MODEL.md](../07-DATA-MODEL.md) §7.2).

## M09.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/notifications` | any auth | List for current user; `?unread=true`, `?page=1&pageSize=20` |
| GET | `/api/v1/notifications/unread-count` | any auth | Returns `{ count: number }` for the bell badge |
| POST | `/api/v1/notifications/:id/read` | any auth (own only) | Mark one as read |
| POST | `/api/v1/notifications/read-all` | any auth | Mark all as read |

## M09.5 Service layer

```
notifications/
├── notifications.module.ts
├── controllers/
│   └── notifications.controller.ts
├── services/
│   ├── notification.service.ts           # public API: emit, list, markRead
│   ├── notification-dispatcher.service.ts # pluggable channel router
│   ├── channels/
│   │   ├── in-app.channel.ts             # default, always-on
│   │   ├── email.channel.ts              # console provider in v1
│   └── notification-templates.service.ts # text rendering
├── repositories/
│   └── notifications.repository.ts
├── dto/
│   ├── list-notifications.dto.ts
│   ├── notification-response.dto.ts
│   └── emit-notification.input.ts        # internal type
└── tests/
```

## M09.6 Public API

```ts
// notification.service.ts (sketch)
export class NotificationService {
  /** In-transaction emit. Uses the passed Prisma tx client. */
  async emit(tx: PrismaClient | TransactionClient, input: EmitInput): Promise<Notification[]> {
    try {
      const rows = await this.write(tx, input);
      // Fire-and-forget dispatch (post-commit, not awaited)
      queueMicrotask(() => this.dispatcher.dispatch(rows).catch(this.logger.error));
      return rows;
    } catch (e) {
      this.logger.error({ err: e, input }, 'Notification emit failed');
      return []; // never throws
    }
  }

  async list(userId: string, filters: ListFilters) { ... }
  async markRead(userId: string, id: string) { ... }
  async markAllRead(userId: string) { ... }
}
```

### `EmitInput`

```ts
type EmitInput = {
  type: NotificationType;
  recipientUserIds: string[];
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
};
```

## M09.7 Recipient resolution

Some notifications target a vendor company (all its users), or all officers, or all managers. The caller resolves these to user IDs:

| Notification | Recipients |
|--------------|-----------|
| `RFQ_PUBLISHED` | All users of assigned vendor companies with role `VENDOR` |
| `QUOTATION_SUBMITTED` | All officers + admins |
| `APPROVAL_REQUESTED` | All managers |
| `APPROVAL_APPROVED` | The officer who shortlisted, vendor primary contact, admins |
| `APPROVAL_REJECTED` | The officer who shortlisted |
| `PO_GENERATED` | Officer who shortlisted, vendor primary contact, admins |
| `PO_SENT` | Vendor primary contact |
| `PO_DELIVERED` | Officer, admins |
| `INVOICE_GENERATED` | Officer, vendor primary contact, admins |
| `INVOICE_PAID` | Officer, vendor primary contact, admins |
| `INVOICE_OVERDUE` | Officers, admins |

**Vendor primary contact**: in v1, this is the first user (by `createdAt`) of the vendor company. In v1.1, this can be a dedicated field on the vendor.

Resolution happens in the calling service. The notification service does not know about vendor companies or roles — it just writes rows for user IDs.

## M09.8 Dispatcher and channels

```ts
// dispatcher.service.ts (sketch)
export class NotificationDispatcher {
  constructor(private channels: NotificationChannel[]) {}

  async dispatch(notifications: Notification[]) {
    for (const channel of this.channels) {
      try {
        await channel.send(notifications);
      } catch (e) {
        this.logger.error({ err: e, channel: channel.name }, 'Channel dispatch failed');
      }
    }
  }
}
```

```ts
// channels/in-app.channel.ts (sketch)
export class InAppChannel implements NotificationChannel {
  name = 'in-app';
  // No-op: the notifications are already in the DB.
  async send(notifications: Notification[]) {
    return { success: true };
  }
}
```

```ts
// channels/email.channel.ts (sketch — v1)
export class EmailChannel implements NotificationChannel {
  name = 'email';
  constructor(private emailProvider: EmailProvider) {}

  async send(notifications: Notification[]) {
    for (const n of notifications) {
      try {
        await this.emailProvider.send({
          to: n.metadata?.recipientEmail,
          subject: n.title,
          body: n.body,
        });
      } catch (e) {
        this.logger.error({ err: e, notificationId: n.id }, 'Email send failed');
      }
    }
    return { success: true };
  }
}
```

In v1, `EmailProvider` is the `ConsoleEmailProvider` which just logs. In v1.1, it's a SendGrid / SES provider.

## M09.9 In-transaction vs post-commit

The `emit()` method can be called with a transaction client so the notification row is part of the same transaction as the business event. After the transaction commits, the dispatcher fires (via `queueMicrotask` or a post-commit hook).

In v1, the dispatcher is **synchronous** (in-process) for simplicity. In v2, it becomes a queued job (BullMQ + Redis or similar).

## M09.10 Read flow

- Frontend fetches `/notifications?unread=true&pageSize=20` on topbar mount and on every 30s while the page is in focus (TanStack Query refetch on focus).
- Bell badge shows the unread count from `/notifications/unread-count`.
- Clicking a notification calls `POST /notifications/:id/read` then navigates to `notification.link`.
- "Mark all as read" calls `POST /notifications/read-all`.

## M09.11 Notification templates

Templates are simple functions: `template(input) => { title, body }`. They are in `notification-templates.service.ts`. No template engine in v1 (no Handlebars, no MJML) — just TS functions. This is easy to read and to test.

```ts
// example
export const rfqPublishedTemplate = (input: { rfq: RfqSnapshot, vendorName: string }) => ({
  title: `New RFQ: ${input.rfq.title}`,
  body: `You have been invited to submit a quotation. Deadline: ${formatDate(input.rfq.deadline)}.`,
  link: `/vendor-portal/rfqs/${input.rfq.id}`,
});
```

## M09.12 Audit and logging

- Every `emit()` call is logged (level: `info`).
- Every channel send attempt is logged (success: `info`, failure: `error`).
- Failed notifications are **not** written to the audit log (audit is for business actions; notification failure is operational).

## M09.13 Edge cases

| Scenario | Behavior |
|----------|----------|
| Recipient user is `INACTIVE` / `SUSPENDED` | They do not receive the notification (the row is still written; the UI simply doesn't show it because they can't log in). |
| Recipient user is `DEACTIVATED` | Same as above. |
| Multiple recipients, one fails to receive (e.g., email bounce) | Other recipients are unaffected. The failed one is logged. |
| Transaction rolls back | The notification row is rolled back too (atomic). The dispatcher never runs. |
| User has 10,000 unread notifications | Pagination handles it. No batch delete in v1. |
| Notification for an event that no longer exists (e.g., RFQ was deleted) | The link returns 404. The user can mark it as read and move on. |
| `link` is malformed | Skipped (the row is still created; the UI shows the title/body without a clickable link). |
| Concurrent mark-read | Idempotent; safe. |
| Mark someone else's notification as read | 403 `OWNERSHIP_DENIED` |
| Reconnect after offline (frontend) | On reconnect, the bell refetches and the badge updates. |
| Notification is sent but user is in a different role now | They still see it (it was valid at emit time). |

## M09.14 Future (not in v1)

- Real email (SendGrid / SES).
- SMS (Twilio).
- Push (Web Push API).
- Webhooks (outbound, for integrations).
- User preferences (per-type opt-in/out).
- Notification grouping (e.g., "5 new quotations" instead of 5 rows).
- Daily / weekly digest.
- Notification search.
