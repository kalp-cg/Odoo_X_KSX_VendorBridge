# 09 — Workflows & Lifecycles

The core promise of VendorBridge is **workflow integrity**. This document is the canonical reference for every state machine, every transition rule, and the inter-entity workflow.

## 9.1 Inter-entity workflow (the big picture)

```
[VENDOR COMPANY]
       │
       │  (Admin verifies)
       ▼
   [ACTIVE]
       │
       │  invited to
       ▼
[RFQ: DRAFT] ──publish──▶ [RFQ: PUBLISHED] ──close──▶ [RFQ: CLOSED]
       │                          │
       │                          │ cancel
       │                          ▼
       │                    [RFQ: CANCELLED]
       │
       │ vendors see + submit
       ▼
[QUOTATION: SUBMITTED] ──officer shortlists──▶ [QUOTATION: SHORTLISTED]
       │                                              │
       │ officer rejects                              │ officer rejects
       ▼                                              ▼
[QUOTATION: REJECTED]                       [QUOTATION: REJECTED]
                                                      │
                                                      │ manager approves
                                                      ▼
                                            [APPROVAL: APPROVED]
                                                      │
                                                      │ (in same transaction)
                                                      ▼
                                            [QUOTATION: ACCEPTED]
                                            [PURCHASE ORDER: GENERATED]
                                            [INVOICE: PENDING]
```

After acceptance, the PO and Invoice follow their own lifecycles (see below).

## 9.2 VendorCompany lifecycle

```
PENDING_VERIFICATION ──(admin verify)──▶ ACTIVE
ACTIVE ──(admin deactivate)──▶ INACTIVE
ACTIVE ──(admin block)──▶ BLOCKED
INACTIVE ──(admin reactivate)──▶ ACTIVE
BLOCKED ──(admin unblock)──▶ ACTIVE
```

**Rules**

- Only `ACTIVE` vendors can be assigned to a new RFQ.
- A vendor with `PENDING_VERIFICATION`, `INACTIVE`, or `BLOCKED` cannot submit quotations.
- Deactivating a vendor does not affect their existing RFQs or quotations in flight.

See [modules/M03-VENDORS.md](modules/M03-VENDORS.md).

## 9.3 RFQ lifecycle

```
DRAFT ──(officer publish)──▶ PUBLISHED
PUBLISHED ──(officer close)──▶ CLOSED
PUBLISHED ──(officer cancel)──▶ CANCELLED
```

**Rules**

- **DRAFT → PUBLISHED** requires:
  - At least one vendor assigned.
  - Deadline in the future.
  - At least one line item.
- **PUBLISHED → CLOSED** requires:
  - All assigned quotations are in a terminal state (`ACCEPTED`, `REJECTED`), OR
  - Manual close (allowed even with open quotations; remaining quotations are marked `REJECTED` automatically with system note "RFQ closed").
- **PUBLISHED → CANCELLED** is allowed any time after publish. All open quotations (`SUBMITTED`, `SHORTLISTED`) are auto-rejected with note "RFQ cancelled".
- **DRAFT → DRAFT** (edit) and **CANCELLED → CLOSED** are not allowed.
- Terminal states: `CLOSED`, `CANCELLED`. No transitions out.

## 9.4 Quotation lifecycle

```
                    (vendor submits)
                            │
[created editable]           ▼
       │              [SUBMITTED]
       │                  │
       │ officer          │ officer
       │ rejects          │ shortlists
       ▼                  ▼
  [REJECTED]          [SHORTLISTED]
                          │
                          │ officer rejects
                          ▼
                     [REJECTED]
                          │
                          │ manager approves
                          ▼
                    [ACCEPTED]
```

**Rules**

- A quotation is **editable** while:
  - Status is `SUBMITTED`, AND
  - `editableUntil > now()` (which is `rfq.deadline`).
- After deadline, the quotation is **locked** regardless of status. UI shows a "deadline passed" banner; API rejects PATCH with `DEADLINE_PASSED`.
- Only **one** quotation per RFQ can be `SHORTLISTED` at a time. Selecting a new shortlist auto-rejects any prior shortlist.
- `SHORTLISTED → ACCEPTED` happens **only** when the manager approves.
- `SHORTLISTED → REJECTED` can happen if:
  - Manager rejects the approval (the quotation is rejected, but a new shortlist can be created).
  - Officer manually withdraws the shortlist (admin-only escape hatch).
- Terminal states: `ACCEPTED`, `REJECTED`.

## 9.5 Approval lifecycle

```
PENDING ──(manager approve)──▶ APPROVED  (terminal)
PENDING ──(manager reject)──▶ REJECTED   (terminal, requires remarks)
```

**Rules**

- An `Approval` is **created** when an officer shortlists a quotation.
- The approving manager **cannot be the same user** who shortlisted (SoD).
- On `APPROVED`:
  - The corresponding `Quotation` transitions to `ACCEPTED`.
  - A `PurchaseOrder` is generated in the same transaction.
  - An `Invoice` is generated from the PO in the same transaction.
  - Audit log + notifications emitted.
- On `REJECTED`:
  - Remarks are mandatory (validated, min 5 chars).
  - The corresponding `Quotation` transitions to `REJECTED`.
  - Officer can shortlist another quotation → a new `Approval(PENDING)` is created.
- Only **one active** (`PENDING` or `APPROVED`) approval per RFQ at any time.

## 9.6 Purchase Order lifecycle

```
GENERATED ──(officer send)──▶ SENT
SENT ──(officer or vendor mark delivered)──▶ DELIVERED
```

**Rules**

- `GENERATED` is set automatically on approval.
- `SENT` requires the PO to exist (idempotent; can be re-set if already `SENT`).
- `DELIVERED` is set when goods are received. The vendor user can mark their own PO as delivered (limited role to support the workflow).
- Terminal state: `DELIVERED`.
- PO is **immutable** once `DELIVERED`. Cancellations are not supported post-generation in v1 (workaround: create a credit note / future feature).

## 9.7 Invoice lifecycle

```
PENDING ──(officer mark paid)──▶ PAID  (terminal)
PENDING ──(system or officer mark overdue)──▶ OVERDUE
OVERDUE ──(officer mark paid)──▶ PAID  (terminal)
```

**Rules**

- `PENDING` is set automatically on PO generation.
- `OVERDUE` is set when `dueDate < now()` and status is `PENDING`. Implemented as a daily job **and** a check on read (defense in depth).
- `PAID` requires explicit officer action. Records `paidAt`.
- Email send does not change status — it's a separate event (`emailedAt`).
- Terminal state: `PAID`.

## 9.8 User account lifecycle

```
INACTIVE ──(admin activate + assign role)──▶ ACTIVE
ACTIVE ──(admin suspend)──▶ SUSPENDED
SUSPENDED ──(admin reactivate)──▶ ACTIVE
ACTIVE ──(admin deactivate)──▶ DEACTIVATED
```

**Rules**

- `INACTIVE` users cannot log in.
- `SUSPENDED` users cannot log in.
- `DEACTIVATED` is terminal. Re-activation is not allowed; a new account must be created.
- Audit log records every status change.

## 9.9 State transition matrix (consolidated)

| From | To | Action | Role |
|------|----|----|------|
| VendorCompany.PENDING_VERIFICATION | ACTIVE | `activate` | ADMIN |
| VendorCompany.ACTIVE | INACTIVE | `deactivate` | ADMIN |
| VendorCompany.ACTIVE | BLOCKED | `block` | ADMIN |
| VendorCompany.BLOCKED | ACTIVE | `unblock` | ADMIN |
| RFQ.DRAFT | PUBLISHED | `publish` | OFFICER, ADMIN |
| RFQ.PUBLISHED | CLOSED | `close` | OFFICER, ADMIN |
| RFQ.PUBLISHED | CANCELLED | `cancel` | OFFICER, ADMIN |
| Quotation.(editable) | SUBMITTED | `submit` | VENDOR |
| Quotation.SUBMITTED | SHORTLISTED | `shortlist` | OFFICER, ADMIN |
| Quotation.SUBMITTED | REJECTED | `reject` | OFFICER, ADMIN |
| Quotation.SHORTLISTED | ACCEPTED | (on approval) | (system) |
| Quotation.SHORTLISTED | REJECTED | `reject` (officer) or (on rejection) | OFFICER, ADMIN, MANAGER (on reject) |
| Approval.(none) | PENDING | (on shortlist) | (system) |
| Approval.PENDING | APPROVED | `approve` | MANAGER |
| Approval.PENDING | REJECTED | `reject` (with remarks) | MANAGER |
| PO.(none) | GENERATED | (on approval) | (system) |
| PO.GENERATED | SENT | `send` | OFFICER, ADMIN |
| PO.SENT | DELIVERED | `markDelivered` | OFFICER, ADMIN, VENDOR (own) |
| Invoice.(none) | PENDING | (on PO) | (system) |
| Invoice.PENDING | PAID | `markPaid` | OFFICER, ADMIN |
| Invoice.PENDING | OVERDUE | (system on deadline) | (system) |
| Invoice.OVERDUE | PAID | `markPaid` | OFFICER, ADMIN |
| User.INACTIVE | ACTIVE | `activate` | ADMIN |
| User.ACTIVE | SUSPENDED | `suspend` | ADMIN |
| User.ACTIVE | DEACTIVATED | `deactivate` | ADMIN |

## 9.10 Implementation pattern

Each entity's state machine is implemented in `<feature>.workflow.ts`:

```ts
// Pseudocode
const transitions = {
  RFQ: {
    DRAFT: ['PUBLISHED'],
    PUBLISHED: ['CLOSED', 'CANCELLED'],
    CLOSED: [],
    CANCELLED: [],
  },
  // ...
};

function canTransition(entity, from, to) {
  return transitions[entity][from].includes(to);
}

function assertTransition(entity, from, to) {
  if (!canTransition(entity, from, to)) {
    throw new WorkflowInvalidTransitionException(entity, from, to);
  }
}
```

State machines are **pure functions** — no DB access. They are called from services **after** loading the current state and **before** the DB write. The DB write and audit/notification emissions are wrapped in a transaction.

## 9.11 Defense in depth

State transitions are guarded at three layers:

1. **Application** — workflow function checks transition validity.
2. **Database** — `CHECK` constraints and triggers where possible (e.g., cannot transition to PUBLISHED if no vendors).
3. **API** — controller refuses the request based on DTO + state.

Bypassing the application layer is impossible without direct DB access (which is forbidden in production).
