<p align="center">
<img src="https://img.shields.io/badge/🏢-VendorBridge-0f172a?style=for-the-badge&labelColor=0f172a" alt="VendorBridge" />
</p>

<h1 align="center">VendorBridge - Procurement & Vendor Management ERP</h1>

<p align="center">
<strong>🚀 Digitizing the entire procurement cycle with structured workflows and immutable auditing</strong>
</p>

<p align="center">
<img src="https://img.shields.io/badge/Hackathon-Ready-gold?style=flat-square" alt="Hackathon" /> <img src="https://img.shields.io/badge/Domain-B2B_SaaS-blue?style=flat-square" alt="Domain" /> <img src="https://img.shields.io/badge/Architecture-Monorepo-brightgreen?style=flat-square" alt="Impact" /> <img src="https://img.shields.io/badge/Security-RBAC_&_JWT-orange?style=flat-square" alt="Innovation" />
</p>

<p align="center">
<img src="https://img.shields.io/badge/Next.js-14.2.18-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" /> <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" /> <img src="https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" /> <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /> <img src="https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
</p>

---

## 🎯 Overview

**VendorBridge** is a comprehensive, workflow-driven Enterprise Resource Planning (ERP) system built to completely digitize procurement pipelines between organizations and vendors. It replaces chaotic email threads, manual PDF generation, and unstructured negotiations with a strict, auditable, and automated digital ledger.

### 🌟 Why VendorBridge?

```mermaid
graph LR
    A[📧 Email Threads] -->|Before| B[❌ Lost Quotations]
    C[🏢 VendorBridge] -->|After| D[✅ Centralized Dashboard]
    
    B --> E[No transparency]
    B --> F[Delayed approvals]
    B --> G[Manual data entry]
    
    D --> H[Automated POs]
    D --> I[Strict RBAC]
    D --> J[Immutable Audit Logs]
    
    style A fill:#ffcccc
    style B fill:#ff6666
    style C fill:#ccffcc
    style D fill:#66ff66
```

---

## ✨ Feature Highlights

### 🔥 Core Features

<table>
<tr>
<td width="50%">

#### 🏢 Procurement Operations
- ✅ Complete Vendor Lifecycle Management
- ✅ Dynamic RFQ Creation & Publishing
- ✅ Side-by-Side Quotation Comparison
- ✅ Automated PO Generation (PDF Export)
- ✅ Invoice Tracking & Payment Management
- ✅ Advanced Data Tables with Filtering
- ✅ In-app Notifications

</td>
<td width="50%">

#### ⚖️ Compliance & Security
- ✅ Strict Role-Based Access Control (RBAC)
- ✅ 4 Unique Tiers: Admin, Officer, Manager, Vendor
- ✅ Immutable Audit Logging (No UPDATE/DELETE)
- ✅ State-Machine Workflow Integrity
- ✅ Secure File/Evidence Attachments via Cloudinary
- ✅ Atomic Document Numbering Generation
- ✅ JWT Authentication

</td>
</tr>
</table>

---

## 🔄 The Procurement Workflow

Our highest priority is **Workflow Integrity**. No step may be bypassed, and every transition must be executed by the authorized role.

```mermaid
flowchart TD
    A[🏢 Vendor Onboarding] --> B[📋 Create RFQ]
    B --> C[📢 Publish to Vendors]
    C --> D[💰 Vendors Submit Quotations]
    
    D --> E{Officer Compares}
    E -->|Shortlists Best| F[👨‍💼 Manager Approval]
    E -->|Rejects| G[❌ End for Vendor]
    
    F -->|Approved| H[📄 Auto-Generate PO]
    F -->|Rejected| E
    
    H --> I[📤 Send & Deliver]
    I --> J[🧾 Generate Invoice]
    J --> K[💳 Mark Paid]

    style A fill:#3498db,color:#fff
    style H fill:#2ecc71,color:#fff
    style K fill:#f39c12,color:#fff
```

### 10-State Procurement Machine
1. **RFQ Lifecycle:** `Draft` → `Published` → `Closed` / `Cancelled`
2. **Quotation Lifecycle:** `Submitted` → `Shortlisted` → `Accepted` / `Rejected`
3. **Approval Lifecycle:** `Pending` → `Approved` / `Rejected`
4. **PO Lifecycle:** `Generated` → `Sent` → `Delivered`
5. **Invoice Lifecycle:** `Pending` → `Paid` / `Overdue`

---

## 👥 User Roles & Permissions

| Feature | ADMIN | OFFICER | MANAGER | VENDOR |
|---------|:------:|:---:|:-----------:|:-----:|
| Manage Vendors | ✅ | ❌ | ❌ | ❌ |
| Create & Publish RFQs | ✅ | ✅ | ❌ | ❌ |
| Submit Quotations | ❌ | ❌ | ❌ | ✅ |
| Compare & Shortlist | ✅ | ✅ | ❌ | ❌ |
| Approve Quotations | ❌ | ❌ | ✅ | ❌ |
| Generate POs & Invoices | ✅ | ✅ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ | ❌ |

---

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "🖥️ Client Layer"
        A[Next.js 14 Frontend<br/>React + TailwindCSS + Shadcn/ui]
    end

    subgraph "🔌 API Gateway"
        B[NestJS Server<br/>REST API + Auth Guards]
    end

    subgraph "💾 Data Layer"
        D[(PostgreSQL 16<br/>Prisma ORM)]
        F[☁️ Cloudinary<br/>File Storage]
    end

    A -->|REST API via Axios| B
    B -->|Prisma Client| D
    B -->|Upload API| F

    style A fill:#000000,stroke:#333,color:#fff
    style B fill:#E0234E,stroke:#333,color:#fff
    style D fill:#336791,stroke:#333,color:#fff
    style F fill:#3448c5,stroke:#333,color:#fff
```

---

## 🛠️ Tech Stack Details

### Frontend
- **Framework:** Next.js 14.2 (App Router)
- **UI Library:** Tailwind CSS + shadcn/ui
- **State & Data Fetching:** TanStack Query (React Query)
- **Forms & Validation:** React Hook Form + Zod
- **Tables:** TanStack Table

### Backend
- **Framework:** NestJS 10 (TypeScript)
- **Database ORM:** Prisma 5
- **Database Engine:** PostgreSQL 16
- **Auth:** JWT (RS256), argon2id hashing
- **PDF Generation:** PDFKit
- **Cloud Storage:** Cloudinary

---

## 📦 Quick Start Installation

**1. Clone & Install**
```bash
pnpm install
```

**2. Environment Configuration**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**3. Database Setup**
```bash
docker compose up -d postgres
pnpm --filter @vb/api prisma migrate deploy
pnpm run prisma:seed  # Populates the demo environment!
```

**4. Start Application**
```bash
pnpm dev
```
- **Web App:** `http://localhost:3000`
- **API:** `http://localhost:4000`

---

## 📚 Project Documentation
VendorBridge comes with an exhaustive suite of documentation located in the `/doc` folder:
- **Product:** Vision, Workflows, Screen references, Business rules.
- **Architecture:** API standards, Tech stack justifications, ER diagrams.
- **Platform:** Audit logging specs, Notifications, RBAC security model.

*Refer to the `/doc` folder for deep architectural insights into individual modules like `M01-AUTH`, `M04-RFQ`, and `M10-AUDIT-LOGS`.*

---

## 🏆 Hackathon Ready
<table>
<tr>
<td align="center">
<strong>🎯 Problem Statement</strong><br/>
Vendor Management ERP
</td>
<td align="center">
<strong>📂 Domain</strong><br/>
B2B Enterprise Software
</td>
<td align="center">
<strong>🛡️ Key Differentiator</strong><br/>
Strict Workflow State Machines & Compliance
</td>
</tr>
</table>
