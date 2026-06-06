'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from 'lucide-react';
import { useAuthStore, getDefaultRouteForRole } from '@/lib/auth';

const workflowSteps = [
  {
    title: 'Vendor onboarding',
    text: 'Capture vendor records, verification status, and documents before procurement starts.',
    icon: Building2,
  },
  {
    title: 'RFQ creation',
    text: 'Publish structured RFQs with deadline controls, required vendors, and clear scope.',
    icon: ClipboardList,
  },
  {
    title: 'Quotation comparison',
    text: 'Compare submitted quotations side by side and shortlist the best-fit offer.',
    icon: FileText,
  },
  {
    title: 'Approval workflow',
    text: 'Route decisions to managers with mandatory remarks on rejection and full audit trace.',
    icon: ShieldCheck,
  },
  {
    title: 'Purchase order',
    text: 'Generate purchase orders only after approval and keep the workflow state intact.',
    icon: Workflow,
  },
  {
    title: 'Invoice tracking',
    text: 'Track invoice status through payment and overdue states without losing context.',
    icon: TrendingUp,
  },
];

const capabilityCards = [
  {
    title: 'Workflow integrity',
    text: 'Every stage is enforced in sequence so procurement activity cannot skip required controls.',
    icon: CheckCircle2,
  },
  {
    title: 'Role-based access',
    text: 'Admins, procurement officers, managers, and vendors each see only the actions they should.',
    icon: Users,
  },
  {
    title: 'Immutable audit logs',
    text: 'Critical events are captured as compliance records and never modified after creation.',
    icon: ShieldCheck,
  },
  {
    title: 'Operational analytics',
    text: 'Dashboards and reports stay tied to live RFQ, quotation, PO, and invoice data.',
    icon: BarChart3,
  },
];

const roleCards = [
  {
    role: 'Admin',
    text: 'Manage users, vendors, settings, and reports with full operational visibility.',
  },
  {
    role: 'Procurement Officer',
    text: 'Run the sourcing pipeline, compare quotes, and generate purchase orders and invoices.',
  },
  {
    role: 'Manager',
    text: 'Review requests, approve or reject actions, and keep the workflow moving with accountability.',
  },
  {
    role: 'Vendor',
    text: 'Respond to RFQs, submit quotations, and track your own procurement activity securely.',
  },
];

const stats = [
  { label: 'Workflow stages', value: '6+', detail: 'from vendor onboarding to invoice payment' },
  { label: 'Audit coverage', value: '100%', detail: 'critical actions recorded automatically' },
  { label: 'Role-aware views', value: '4', detail: 'admin, officer, manager, and vendor' },
];

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'loading' && accessToken && user) {
      router.replace(getDefaultRouteForRole(user.role));
    }
  }, [accessToken, user, status, router]);

  return (
    <main className="relative isolate overflow-hidden bg-gradient-to-b from-ink-50 via-white to-brand-50/40 text-ink-800">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-[-6rem] h-80 w-80 rounded-full bg-brand-300/20 blur-3xl" />
        <div className="absolute top-40 right-[-8rem] h-96 w-96 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/60 to-transparent" />
      </div>

      <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-ink-800">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-600 text-white shadow-card">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-lg font-semibold leading-none">VendorBridge</div>
              <div className="text-xs text-ink-500">Procurement & Vendor Management ERP</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-600 md:flex">
            <Link href="#workflow" className="transition-colors hover:text-ink-900">
              Workflow
            </Link>
            <Link href="#capabilities" className="transition-colors hover:text-ink-900">
              Capabilities
            </Link>
            <Link href="#roles" className="transition-colors hover:text-ink-900">
              Roles
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/login?signup=1" className="btn-primary">
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:pt-20">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-800 shadow-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Workflow-first procurement built for control
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-ink-900 sm:text-5xl lg:text-6xl">
            Run procurement with a clean flow, visible control, and no skipped steps.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-600">
            VendorBridge digitizes the full procurement cycle from vendor onboarding to invoice payment.
            It keeps approvals, audit logs, and reporting tied to real workflow state so your team can move fast without losing compliance.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login?signup=1" className="btn-primary px-5 py-3 text-base">
              Open the platform
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="#workflow" className="btn-secondary px-5 py-3 text-base">
              See the workflow
            </Link>
          </div>

          <p className="mt-4 text-sm text-ink-500">
            No workflow step may be skipped. Every critical action is recorded.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label} className="card-pad bg-white/90 backdrop-blur-sm">
                <div className="text-sm font-medium text-ink-500">{stat.label}</div>
                <div className="mt-2 text-3xl font-semibold text-ink-900">{stat.value}</div>
                <p className="mt-2 text-sm leading-6 text-ink-500">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 lg:pl-4">
          <div className="rounded-[1.75rem] border border-ink-200 bg-white/90 p-4 shadow-card backdrop-blur-sm sm:p-6">
            <div className="flex items-center justify-between gap-4 border-b border-ink-100 pb-4">
              <div>
                <div className="text-sm font-medium text-ink-500">Live procurement view</div>
                <div className="mt-1 text-xl font-semibold text-ink-900">Current cycle overview</div>
              </div>
              <div className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                Workflow active
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Open RFQs', value: '18', tone: 'bg-brand-50 text-brand-700' },
                { label: 'Pending approvals', value: '07', tone: 'bg-amber-50 text-amber-700' },
                { label: 'Invoices due', value: '03', tone: 'bg-blue-50 text-blue-700' },
              ].map((item) => (
                <div key={item.label} className={`rounded-2xl p-4 ${item.tone}`}>
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.label}</div>
                  <div className="mt-2 text-3xl font-semibold leading-none">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-ink-100 bg-ink-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink-900">Procurement flow</div>
                  <div className="text-xs text-ink-500">RFQ → Quotation → Approval → PO → Invoice</div>
                </div>
                <div className="badge bg-emerald-100 text-emerald-800">On track</div>
              </div>

              <div className="mt-4 space-y-3">
                {[
                  ['Vendors verified', '8 active vendors', 'bg-emerald-100'],
                  ['Quotation review', '4 shortlisted responses', 'bg-blue-100'],
                  ['Approval queue', '2 manager actions pending', 'bg-amber-100'],
                  ['Audit log', 'Every state change captured', 'bg-ink-200'],
                ].map(([title, detail, tone]) => (
                  <div key={title} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
                    <div className={`h-10 w-10 rounded-xl ${tone} grid place-items-center text-xs font-semibold text-ink-800`}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink-900">{title}</div>
                      <div className="text-xs text-ink-500">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">Compliance</div>
                <div className="mt-2 text-sm font-medium text-ink-900">Immutable audit records</div>
                <p className="mt-1 text-sm leading-6 text-ink-600">Critical actions are stored as compliance events, not editable notes.</p>
              </div>
              <div className="rounded-2xl border border-ink-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">Reporting</div>
                <div className="mt-2 text-sm font-medium text-ink-900">Live operational analytics</div>
                <p className="mt-1 text-sm leading-6 text-ink-600">Reports stay grounded in procurement data, not duplicated summaries.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="label">Workflow</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            A procurement flow that stays disciplined from first vendor to final invoice.
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-600">
            Each stage is designed around a simple rule: move forward only when the required data, review,
            and approval exist. That keeps the process auditable and predictable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="card-pad group transition-transform duration-200 hover:-translate-y-1 hover:shadow-card">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-brand-700">Step {index + 1}</div>
                    <h3 className="mt-1 text-lg font-semibold text-ink-900">{step.title}</h3>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-ink-600">{step.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="capabilities" className="border-y border-ink-200 bg-white/70 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <div className="label">Capabilities</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
              Built for control, visibility, and fast decision-making.
            </h2>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilityCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="card-pad bg-white">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-50 text-brand-700 ring-1 ring-ink-100">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink-900">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-600">{card.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <div className="label">Roles</div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">
            Every user sees the right tools for the work they own.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {roleCards.map((card) => (
            <div key={card.role} className="card-pad bg-white">
              <div className="text-sm font-semibold uppercase tracking-wide text-brand-700">{card.role}</div>
              <p className="mt-3 text-sm leading-6 text-ink-600">{card.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-[1.75rem] border border-brand-200 bg-gradient-to-r from-brand-700 to-brand-600 px-6 py-8 text-white shadow-card sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Ready to begin</div>
              <h3 className="mt-3 text-2xl font-semibold sm:text-3xl">Open the landing page, then move straight into the workflow.</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                The homepage gives you a clear overview of what VendorBridge does. When you are ready, sign in to continue into the live app.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50">
                Sign in
              </Link>
              <Link href="/login?signup=1" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15">
                Create account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
