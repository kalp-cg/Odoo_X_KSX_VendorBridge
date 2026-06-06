/**
 * Comprehensive seed — runs with: pnpm prisma:seed
 *
 * Builds a realistic, fully-connected procurement dataset that exercises
 * EVERY screen in the VendorBridge app (per the problem statement):
 *
 *   • 5 internal users (admin + 2 officers + 2 managers) + 8 vendors
 *     with 1-2 vendor users each, covering all 4 vendor lifecycle states.
 *   • 8 RFQs across all 4 statuses (DRAFT / PUBLISHED / CLOSED / CANCELLED)
 *     with realistic line items and assigned vendors.
 *   • 15+ quotations across the lifecycle: SUBMITTED, SHORTLISTED,
 *     ACCEPTED, REJECTED.
 *   • 4+ approvals (PENDING, APPROVED, REJECTED) and the resulting
 *     Purchase Orders (GENERATED, SENT, DELIVERED) + matching invoices
 *     (PENDING, PAID, OVERDUE) with line items + status events.
 *   • Audit logs and notifications for every state transition.
 *   • SequenceTracker rows so RFQ-YYYY-0001, Q-YYYY-0001, etc. start fresh.
 *   • Historical 30-day window of invoices for spend-by-vendor and
 *     monthly-trend reports.
 *
 * Idempotent: every entity is keyed by a unique natural id (email / GST /
 * number) so re-running the seed is safe.
 */
import 'dotenv/config';
import {
  PrismaClient,
  Prisma,
  RfqStatus,
  RfqVendorStatus,
  UserRole,
  UserStatus,
  VendorStatus,
  QuotationStatus,
  ApprovalStatus,
  PoStatus,
  InvoiceStatus,
  AuditAction,
  AuditEntityType,
  NotificationType,
  PaymentMethod,
} from '@prisma/client';
import { hash as argonHash } from 'argon2';

const prisma = new PrismaClient();

// =====================================================================
//  HELPERS
// =====================================================================
const D = (v: number | string): Prisma.Decimal => new Prisma.Decimal(v);
const daysAgo = (n: number): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
};
const daysAhead = (n: number): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
const year = new Date().getUTCFullYear();

// =====================================================================
//  VENDOR CATALOG (10 realistic companies across all statuses)
// =====================================================================
const VENDOR_SEED: Array<{
  key: string;
  legalName: string;
  displayName: string;
  gstNumber: string;
  panNumber: string;
  registrationNo: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  category: string;
  status: VendorStatus;
  rating: number;
  notes: string;
  users: Array<{ email: string; fullName: string; phone: string }>;
}> = [
  {
    key: 'acme',
    legalName: 'Acme Industrial Supplies Pvt. Ltd.',
    displayName: 'Acme Supplies',
    gstNumber: '27AAAAA0000A1Z5',
    panNumber: 'AAAAA0000A',
    registrationNo: 'U28910MH2015PTC261234',
    contactEmail: 'contact@acme.example',
    contactPhone: '+91-9000000001',
    addressLine1: 'Plot 14, MIDC Industrial Area',
    addressLine2: 'Andheri East',
    city: 'Mumbai', state: 'MH', postalCode: '400093', country: 'India',
    category: 'Industrial', status: VendorStatus.ACTIVE, rating: 4.5,
    notes: 'Long-term partner for industrial supplies. Preferred for steel & fasteners.',
    users: [
      { email: 'vendor@acme.example', fullName: 'Aman Acme', phone: '+91-9000000001' },
      { email: 'sales@acme.example', fullName: 'Anita Acme', phone: '+91-9000000011' },
    ],
  },
  {
    key: 'bluepeak',
    legalName: 'Bluepeak Office Solutions LLP',
    displayName: 'Bluepeak',
    gstNumber: '29BBBBB0000B1Z3',
    panNumber: 'BBBBB0000B',
    registrationNo: 'AAFLB1234B',
    contactEmail: 'hello@bluepeak.example',
    contactPhone: '+91-9000000002',
    addressLine1: '4 MG Road',
    addressLine2: 'Indiranagar',
    city: 'Bengaluru', state: 'KA', postalCode: '560038', country: 'India',
    category: 'Office', status: VendorStatus.ACTIVE, rating: 4.2,
    notes: 'Office furniture, modular workstations, ergonomic seating.',
    users: [
      { email: 'vendor@bluepeak.example', fullName: 'Bina Bluepeak', phone: '+91-9000000002' },
    ],
  },
  {
    key: 'crescent',
    legalName: 'Crescent IT Hardware Distributors',
    displayName: 'Crescent IT',
    gstNumber: '07CCCCC0000C1Z1',
    panNumber: 'CCCCC0000C',
    registrationNo: 'U51909DL2018PTC332001',
    contactEmail: 'sales@crescentit.example',
    contactPhone: '+91-9000000003',
    addressLine1: 'C-23, Connaught Place',
    city: 'New Delhi', state: 'DL', postalCode: '110001', country: 'India',
    category: 'IT Hardware', status: VendorStatus.ACTIVE, rating: 4.7,
    notes: 'Authorised distributor for Dell, HP, Lenovo. 3-year onsite warranty included.',
    users: [
      { email: 'vendor@crescentit.example', fullName: 'Chirag Crescent', phone: '+91-9000000003' },
    ],
  },
  {
    key: 'delhiprint',
    legalName: 'Delhi Print & Stationery House',
    displayName: 'Delhi Print',
    gstNumber: '07DDDDD0000D1Z9',
    panNumber: 'DDDDD0000D',
    registrationNo: 'GST07DDDDD0000D1Z9',
    contactEmail: 'orders@delhiprint.example',
    contactPhone: '+91-9000000004',
    addressLine1: 'Shop 17, Karol Bagh Market',
    city: 'New Delhi', state: 'DL', postalCode: '110005', country: 'India',
    category: 'Stationery', status: VendorStatus.ACTIVE, rating: 3.9,
    notes: 'Bulk printing, stationery supplies, business cards.',
    users: [
      { email: 'vendor@delhiprint.example', fullName: 'Deepa Delhi', phone: '+91-9000000004' },
    ],
  },
  {
    key: 'evergreen',
    legalName: 'Evergreen Catering Services',
    displayName: 'Evergreen Caterers',
    gstNumber: '33EEEEE0000E1Z7',
    panNumber: 'EEEEE0000E',
    registrationNo: 'U55209TN2017OPC119876',
    contactEmail: 'bookings@evergreen.example',
    contactPhone: '+91-9000000005',
    addressLine1: '12 Cathedral Road',
    city: 'Chennai', state: 'TN', postalCode: '600086', country: 'India',
    category: 'Catering', status: VendorStatus.ACTIVE, rating: 4.4,
    notes: 'Corporate catering, dietary preferences supported (veg/jain/vegan).',
    users: [
      { email: 'vendor@evergreen.example', fullName: 'Esha Evergreen', phone: '+91-9000000005' },
    ],
  },
  {
    key: 'fortis',
    legalName: 'Fortis Security Services Pvt. Ltd.',
    displayName: 'Fortis Security',
    gstNumber: '24FFFFF0000F1Z5',
    panNumber: 'FFFFF0000F',
    registrationNo: 'U74920GJ2016PTC094321',
    contactEmail: 'ops@fortissec.example',
    contactPhone: '+91-9000000006',
    addressLine1: 'Tower B, SG Highway',
    city: 'Ahmedabad', state: 'GJ', postalCode: '380054', country: 'India',
    category: 'Facilities', status: VendorStatus.ACTIVE, rating: 4.1,
    notes: 'Manned guarding, electronic surveillance, access control.',
    users: [
      { email: 'vendor@fortissec.example', fullName: 'Faisal Fortis', phone: '+91-9000000006' },
    ],
  },
  {
    key: 'globex',
    legalName: 'Globex Logistics India Pvt. Ltd.',
    displayName: 'Globex Logistics',
    gstNumber: '06GGGGG0000G1Z3',
    panNumber: 'GGGGG0000G',
    registrationNo: 'U63090HR2015PTC067432',
    contactEmail: 'dispatch@globex.example',
    contactPhone: '+91-9000000007',
    addressLine1: 'Plot 42, IFFCO Chowk',
    city: 'Gurugram', state: 'HR', postalCode: '122001', country: 'India',
    category: 'Logistics', status: VendorStatus.PENDING_VERIFICATION, rating: 0,
    notes: 'New vendor, awaiting GST verification and PSARA license check.',
    users: [
      { email: 'vendor@globex.example', fullName: 'Gaurav Globex', phone: '+91-9000000007' },
    ],
  },
  {
    key: 'horizon',
    legalName: 'Horizon Power Solutions',
    displayName: 'Horizon Power',
    gstNumber: '36HHHHH0000H1Z1',
    panNumber: 'HHHHH0000H',
    registrationNo: 'U40109KA2014PTC076543',
    contactEmail: 'sales@horizonpower.example',
    contactPhone: '+91-9000000008',
    addressLine1: 'Survey 56, Electronic City Phase 2',
    city: 'Bengaluru', state: 'KA', postalCode: '560100', country: 'India',
    category: 'Electricals', status: VendorStatus.INACTIVE, rating: 3.5,
    notes: 'Previously used for UPS procurement. Inactive since FY24-Q3.',
    users: [
      { email: 'vendor@horizonpower.example', fullName: 'Hari Horizon', phone: '+91-9000000008' },
    ],
  },
  {
    key: 'indus',
    legalName: 'Indus Cleaning & Facility Mgmt',
    displayName: 'Indus Facility',
    gstNumber: '09IIIII0000I1Z9',
    panNumber: 'IIIII0000I',
    registrationNo: 'U74999UP2018PTC102345',
    contactEmail: 'service@indusfacility.example',
    contactPhone: '+91-9000000009',
    addressLine1: 'B-7, Sector 62',
    city: 'Noida', state: 'UP', postalCode: '201301', country: 'India',
    category: 'Facilities', status: VendorStatus.BLOCKED, rating: 2.0,
    notes: 'Blocked: SLA breaches in Q4 FY24. Pending vendor review board decision.',
    users: [
      { email: 'vendor@indusfacility.example', fullName: 'Ishan Indus', phone: '+91-9000000009' },
    ],
  },
  {
    key: 'jade',
    legalName: 'Jade Stationery & Print',
    displayName: 'Jade Stationery',
    gstNumber: '19JJJJJ0000J1Z7',
    panNumber: 'JJJJJ0000J',
    registrationNo: 'AAACJ9876J',
    contactEmail: 'orders@jade.example',
    contactPhone: '+91-9000000010',
    addressLine1: '21 Park Street',
    city: 'Kolkata', state: 'WB', postalCode: '700016', country: 'India',
    category: 'Stationery', status: VendorStatus.ACTIVE, rating: 4.0,
    notes: 'Backup vendor for stationery; good for branded merchandise.',
    users: [
      { email: 'vendor@jade.example', fullName: 'Jaya Jade', phone: '+91-9000000010' },
    ],
  },
];

// =====================================================================
//  RFQ SEED (8 RFQs, one of every state + some past history)
// =====================================================================
type LineSpec = { description: string; quantity: number; unit: string; targetUnitPrice: number; notes?: string };
type RfqSeed = {
  number: string;
  title: string;
  description: string;
  status: RfqStatus;
  daysAgoCreated: number;
  daysAheadDeadline: number;          // negative = in the past
  publishedDaysAgo?: number;
  closedDaysAgo?: number;
  cancelledDaysAgo?: number;
  cancelReason?: string;
  vendors: string[];                  // vendor keys
  lineItems: LineSpec[];
  createdBy: string;                  // user email
};

const RFQ_SEED: RfqSeed[] = [
  {
    number: `RFQ-${year}-0001`,
    title: 'Office chairs and desks — Phase 1',
    description: 'Ergonomic seating and modular desks for the new Bengaluru office floor.',
    status: RfqStatus.DRAFT, daysAgoCreated: 2, daysAheadDeadline: 14,
    vendors: ['acme', 'bluepeak'],
    lineItems: [
      { description: 'Ergonomic office chair (mesh back)', quantity: 25, unit: 'EA', targetUnitPrice: 7500 },
      { description: 'Modular desk 120x60cm with cable tray', quantity: 25, unit: 'EA', targetUnitPrice: 12000 },
    ],
    createdBy: 'officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0002`,
    title: 'Laptops for engineering team — H1 FY26',
    description: '14" laptops, 16GB RAM, 512GB SSD, 3-year onsite warranty. Need 30 units across engineering.',
    status: RfqStatus.PUBLISHED, daysAgoCreated: 6, daysAheadDeadline: 10,
    publishedDaysAgo: 5,
    vendors: ['crescent', 'acme'],
    lineItems: [
      { description: '14" business laptop, i5/16GB/512GB/Win11 Pro', quantity: 30, unit: 'EA', targetUnitPrice: 72000, notes: 'Onsite warranty 3 years mandatory' },
      { description: 'USB-C docking station', quantity: 30, unit: 'EA', targetUnitPrice: 6500 },
    ],
    createdBy: 'officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0003`,
    title: 'Quarterly stationery replenishment',
    description: 'Standard stationery items for Q3 — A4 paper, file folders, marker pens, staplers, etc.',
    status: RfqStatus.PUBLISHED, daysAgoCreated: 4, daysAheadDeadline: 8,
    publishedDaysAgo: 4,
    vendors: ['delhiprint', 'jade', 'acme'],
    lineItems: [
      { description: 'A4 copier paper 80gsm (500 sheet ream)', quantity: 200, unit: 'REAM', targetUnitPrice: 280 },
      { description: 'Box file (PVC, A4)', quantity: 100, unit: 'EA', targetUnitPrice: 95 },
      { description: 'Whiteboard marker (set of 4)', quantity: 50, unit: 'SET', targetUnitPrice: 220 },
    ],
    createdBy: 'priya.officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0004`,
    title: 'Catering for Q3 all-hands (250 pax)',
    description: 'Lunch + hi-tea for the all-hands at the Bengaluru office, 250 attendees, vegetarian + non-veg options.',
    status: RfqStatus.PUBLISHED, daysAgoCreated: 7, daysAheadDeadline: 5,
    publishedDaysAgo: 6,
    vendors: ['evergreen'],
    lineItems: [
      { description: 'Vegetarian lunch box (per pax)', quantity: 150, unit: 'PAX', targetUnitPrice: 350 },
      { description: 'Non-veg lunch box (per pax)', quantity: 100, unit: 'PAX', targetUnitPrice: 450 },
      { description: 'Hi-tea snacks platter (per table of 8)', quantity: 32, unit: 'TBL', targetUnitPrice: 1800 },
    ],
    createdBy: 'priya.officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0005`,
    title: 'Annual security contract — Bengaluru office',
    description: '6 guards (3 day, 3 night) + supervisor, 365 days, PSARA-licensed vendor only.',
    status: RfqStatus.CLOSED, daysAgoCreated: 35, daysAheadDeadline: -5,
    publishedDaysAgo: 30, closedDaysAgo: 4,
    vendors: ['fortis'],
    lineItems: [
      { description: 'Security guard (day shift, monthly)', quantity: 36, unit: 'PM', targetUnitPrice: 28000 },
      { description: 'Security guard (night shift, monthly)', quantity: 36, unit: 'PM', targetUnitPrice: 32000 },
      { description: 'Supervisor (monthly)', quantity: 12, unit: 'PM', targetUnitPrice: 45000 },
    ],
    createdBy: 'officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0006`,
    title: 'Workstation monitors 27" — 60 units',
    description: '27" QHD monitors, HDMI+DP+USB-C, ergonomic stand, TUV-certified low blue light.',
    status: RfqStatus.CLOSED, daysAgoCreated: 50, daysAheadDeadline: -10,
    publishedDaysAgo: 48, closedDaysAgo: 12,
    vendors: ['crescent', 'acme'],
    lineItems: [
      { description: '27" QHD IPS monitor with USB-C dock', quantity: 60, unit: 'EA', targetUnitPrice: 24500 },
    ],
    createdBy: 'officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0007`,
    title: 'Janitorial services — pilot (1 month)',
    description: 'Pilot month for janitorial services at the Mumbai office, Mon-Sat.',
    status: RfqStatus.CANCELLED, daysAgoCreated: 25, daysAheadDeadline: -2,
    publishedDaysAgo: 24, cancelledDaysAgo: 14,
    cancelReason: 'Vendor Ind\u2019s PSARA license expired; cancelled to re-tender with valid vendors.',
    vendors: ['indus'],
    lineItems: [
      { description: 'Janitor (8 hrs/day, 6 days/week)', quantity: 1, unit: 'PM', targetUnitPrice: 65000 },
    ],
    createdBy: 'priya.officer@vendorbridge.local',
  },
  {
    number: `RFQ-${year}-0008`,
    title: 'Branded merchandise — annual kit',
    description: 'Branded tote bags, notebooks, pens and water bottles for new joiners.',
    status: RfqStatus.PUBLISHED, daysAgoCreated: 1, daysAheadDeadline: 21,
    publishedDaysAgo: 1,
    vendors: ['jade', 'delhiprint'],
    lineItems: [
      { description: 'Branded tote bag (cotton)', quantity: 300, unit: 'EA', targetUnitPrice: 180 },
      { description: 'A5 notebook with company logo', quantity: 300, unit: 'EA', targetUnitPrice: 95 },
      { description: 'Metal pen with company logo', quantity: 300, unit: 'EA', targetUnitPrice: 65 },
      { description: 'Steel water bottle 750ml', quantity: 300, unit: 'EA', targetUnitPrice: 220 },
    ],
    createdBy: 'priya.officer@vendorbridge.local',
  },
];

// =====================================================================
//  MAIN
// =====================================================================
async function main(): Promise<void> {
  const password = 'Password123!';
  const hash = await argonHash(password);

  // -----------------------------------------------------------------
  // 1) USERS
  // -----------------------------------------------------------------
  console.log('\u2022 Creating users\u2026');
  const users = {
    admin: await upsertUser('admin@vendorbridge.local', 'System Admin', UserRole.ADMIN, hash, { phone: '+91-9000000099' }),
    officer: await upsertUser('officer@vendorbridge.local', 'Olivia Officer', UserRole.OFFICER, hash, { phone: '+91-9000000091' }),
    priya: await upsertUser('priya.officer@vendorbridge.local', 'Priya Procurement', UserRole.OFFICER, hash, { phone: '+91-9000000092' }),
    manager: await upsertUser('manager@vendorbridge.local', 'Maya Manager', UserRole.MANAGER, hash, { phone: '+91-9000000081' }),
    rohan: await upsertUser('rohan.manager@vendorbridge.local', 'Rohan Reviewer', UserRole.MANAGER, hash, { phone: '+91-9000000082' }),
  };

  // -----------------------------------------------------------------
  // 2) VENDORS + VENDOR USERS
  // -----------------------------------------------------------------
  console.log('\u2022 Creating vendors & vendor users\u2026');
  const vendorByKey = new Map<string, { id: string; legalName: string; displayName: string }>();
  for (const v of VENDOR_SEED) {
    const vc = await prisma.vendorCompany.upsert({
      where: { gstNumber: v.gstNumber },
      update: {
        legalName: v.legalName,
        displayName: v.displayName,
        panNumber: v.panNumber,
        registrationNo: v.registrationNo,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        addressLine1: v.addressLine1,
        addressLine2: v.addressLine2,
        city: v.city,
        state: v.state,
        postalCode: v.postalCode,
        country: v.country,
        category: v.category,
        status: v.status,
        rating: v.rating > 0 ? D(v.rating) : null,
        notes: v.notes,
      },
      create: {
        legalName: v.legalName,
        displayName: v.displayName,
        gstNumber: v.gstNumber,
        panNumber: v.panNumber,
        registrationNo: v.registrationNo,
        contactEmail: v.contactEmail,
        contactPhone: v.contactPhone,
        addressLine1: v.addressLine1,
        addressLine2: v.addressLine2,
        city: v.city,
        state: v.state,
        postalCode: v.postalCode,
        country: v.country,
        category: v.category,
        status: v.status,
        rating: v.rating > 0 ? D(v.rating) : null,
        notes: v.notes,
        createdById: users.admin.id,
      },
    });
    vendorByKey.set(v.key, { id: vc.id, legalName: vc.legalName, displayName: vc.displayName });
    for (const u of v.users) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: {
          fullName: u.fullName,
          phone: u.phone,
          role: UserRole.VENDOR,
          status: v.status === VendorStatus.BLOCKED ? UserStatus.INACTIVE : UserStatus.ACTIVE,
          vendorCompanyId: vc.id,
        },
        create: {
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          role: UserRole.VENDOR,
          status: v.status === VendorStatus.BLOCKED ? UserStatus.INACTIVE : UserStatus.ACTIVE,
          passwordHash: hash,
          vendorCompanyId: vc.id,
        },
      });
    }
  }

  // -----------------------------------------------------------------
  // 3) SEQUENCE TRACKER — reset to 1 so the first user-created doc is 0001
  // -----------------------------------------------------------------
  console.log('\u2022 Resetting sequence counters\u2026');
  for (const id of ['rfq', 'quotation', 'purchase_order', 'invoice', 'PO', 'Q', 'INV']) {
    await prisma.sequenceTracker.upsert({
      where: { id_year: { id, year } },
      update: { lastValue: 0 },
      create: { id, year, lastValue: 0 },
    });
  }

  // -----------------------------------------------------------------
  // 4) RFQs + RFQ line items + RFQ vendor invites + audit log
  // -----------------------------------------------------------------
  console.log('\u2022 Creating RFQs\u2026');
  const rfqByNumber = new Map<string, { id: string; vendorIds: string[]; lineItemIds: { lineNo: number; id: string }[]; status: RfqStatus }>();
  for (const r of RFQ_SEED) {
    const creator = await prisma.user.findUniqueOrThrow({ where: { email: r.createdBy } });
    // Skip if already exists with the right number (idempotent).
    const existing = await prisma.rfq.findUnique({ where: { number: r.number } });
    if (existing) {
      rfqByNumber.set(r.number, {
        id: existing.id,
        vendorIds: (await prisma.rfqVendor.findMany({ where: { rfqId: existing.id }, select: { vendorId: true } })).map((v) => v.vendorId),
        lineItemIds: (await prisma.rfqLineItem.findMany({ where: { rfqId: existing.id }, select: { id: true, lineNo: true } })).map((x) => ({ lineNo: x.lineNo, id: x.id })),
        status: existing.status,
      });
      continue;
    }

    const rfq = await prisma.$transaction(async (tx) => {
      const r2 = await tx.rfq.create({
        data: {
          number: r.number,
          title: r.title,
          description: r.description,
          status: r.status,
          deadline: daysAhead(r.daysAheadDeadline),
          publishedAt: r.publishedDaysAgo != null ? daysAgo(r.publishedDaysAgo) : null,
          closedAt: r.closedDaysAgo != null ? daysAgo(r.closedDaysAgo) : null,
          cancelledAt: r.cancelledDaysAgo != null ? daysAgo(r.cancelledDaysAgo) : null,
          cancelReason: r.cancelReason,
          createdById: creator.id,
          createdAt: daysAgo(r.daysAgoCreated),
        },
      });
      const lineItems = [];
      for (let i = 0; i < r.lineItems.length; i++) {
        const li = r.lineItems[i];
        const created = await tx.rfqLineItem.create({
          data: {
            rfqId: r2.id,
            lineNo: i + 1,
            description: li.description,
            quantity: D(li.quantity),
            unit: li.unit,
            targetUnitPrice: D(li.targetUnitPrice),
            notes: li.notes,
            createdById: creator.id,
          },
        });
        lineItems.push({ lineNo: created.lineNo, id: created.id });
      }
      const vendorIds: string[] = [];
      for (const vkey of r.vendors) {
        const v = vendorByKey.get(vkey);
        if (!v) throw new Error(`Unknown vendor key ${vkey}`);
        const rfv = await tx.rfqVendor.create({
          data: {
            rfqId: r2.id,
            vendorId: v.id,
            status: r.status === RfqStatus.DRAFT ? RfqVendorStatus.INVITED : RfqVendorStatus.RESPONDED,
            invitedAt: r.publishedDaysAgo != null ? daysAgo(r.publishedDaysAgo) : daysAgo(r.daysAgoCreated),
            respondedAt: r.status !== RfqStatus.DRAFT ? daysAgo(Math.max(0, r.daysAgoCreated - 1)) : null,
          },
        });
        vendorIds.push(v.id);
        void rfv;
      }
      await tx.auditLog.create({
        data: {
          action: AuditAction.RFQ_CREATED,
          entityType: AuditEntityType.RFQ,
          entityId: r2.id,
          description: `RFQ created: ${r2.number} \u2014 ${r2.title}`,
          metadata: { number: r2.number, vendorCount: vendorIds.length, lineItemCount: r.lineItems.length } as Prisma.JsonObject,
          actorId: creator.id,
          actorEmail: creator.email,
          occurredAt: r2.createdAt,
        },
      });
      if (r.status === RfqStatus.PUBLISHED) {
        await tx.auditLog.create({
          data: {
            action: AuditAction.RFQ_PUBLISHED,
            entityType: AuditEntityType.RFQ,
            entityId: r2.id,
            description: `RFQ published: ${r2.number}`,
            actorId: creator.id,
            actorEmail: creator.email,
            occurredAt: r2.publishedAt ?? new Date(),
          },
        });
      }
      if (r.status === RfqStatus.CLOSED) {
        await tx.auditLog.create({
          data: {
            action: AuditAction.RFQ_CLOSED,
            entityType: AuditEntityType.RFQ,
            entityId: r2.id,
            description: `RFQ closed: ${r2.number}`,
            actorId: users.manager.id,
            actorEmail: users.manager.email,
            occurredAt: r2.closedAt ?? new Date(),
          },
        });
      }
      if (r.status === RfqStatus.CANCELLED) {
        await tx.auditLog.create({
          data: {
            action: AuditAction.RFQ_CANCELLED,
            entityType: AuditEntityType.RFQ,
            entityId: r2.id,
            description: `RFQ cancelled: ${r2.number} \u2014 ${r.cancelReason}`,
            actorId: creator.id,
            actorEmail: creator.email,
            occurredAt: r2.cancelledAt ?? new Date(),
          },
        });
      }
      return r2;
    });

    rfqByNumber.set(r.number, { id: rfq.id, vendorIds: [], lineItemIds: [], status: rfq.status });
    const ref = rfqByNumber.get(r.number)!;
    ref.vendorIds = (await prisma.rfqVendor.findMany({ where: { rfqId: rfq.id }, select: { vendorId: true } })).map((v) => v.vendorId);
    ref.lineItemIds = (await prisma.rfqLineItem.findMany({ where: { rfqId: rfq.id }, select: { id: true, lineNo: true } })).map((x) => ({ lineNo: x.lineNo, id: x.id }));
  }

  // -----------------------------------------------------------------
  // 5) QUOTATIONS
  // -----------------------------------------------------------------
  console.log('\u2022 Creating quotations\u2026');
  // helper to compute total
  const computeTotal = (prices: Array<{ unitPrice: number; quantity: number }>): number =>
    prices.reduce((s, p) => s + p.unitPrice * p.quantity, 0);

  const quotations: Array<{
    number: string; rfqNumber: string; vendorKey: string;
    status: QuotationStatus; isLocked: boolean; total: number;
    deliveryDays: number; notes: string; submittedDaysAgo: number;
    unitPrices: number[]; // aligns with lineItem order of the RFQ
  }> = [
    // RFQ-0002 (laptops) — 2 quotations, one will be shortlisted
    { number: `Q-${year}-0001`, rfqNumber: `RFQ-${year}-0002`, vendorKey: 'crescent', status: QuotationStatus.ACCEPTED, isLocked: true, total: 0, deliveryDays: 14, notes: 'Genuine Dell Latitude 5440, 3-year onsite. Includes docking stations bundled at 6000 each.', submittedDaysAgo: 4, unitPrices: [69500, 6000] },
    { number: `Q-${year}-0002`, rfqNumber: `RFQ-${year}-0002`, vendorKey: 'acme',      status: QuotationStatus.SUBMITTED, isLocked: true, total: 0, deliveryDays: 10, notes: 'HP ProBook 440 G10, 3-year onsite, slightly cheaper but earlier delivery.', submittedDaysAgo: 3, unitPrices: [71000, 6500] },

    // RFQ-0003 (stationery) — 3 quotations (one will be shortlisted for approval)
    { number: `Q-${year}-0003`, rfqNumber: `RFQ-${year}-0003`, vendorKey: 'delhiprint', status: QuotationStatus.SUBMITTED, isLocked: true, total: 0, deliveryDays: 7, notes: 'JK Easy Copier paper. Free delivery within Delhi NCR.', submittedDaysAgo: 2, unitPrices: [272, 88, 210] },
    { number: `Q-${year}-0004`, rfqNumber: `RFQ-${year}-0003`, vendorKey: 'jade',       status: QuotationStatus.SHORTLISTED, isLocked: false, total: 0, deliveryDays: 10, notes: 'Century Pukkadata. Free branded stickers with every box file order.', submittedDaysAgo: 2, unitPrices: [285, 90, 215] },
    { number: `Q-${year}-0005`, rfqNumber: `RFQ-${year}-0003`, vendorKey: 'acme',       status: QuotationStatus.REJECTED, isLocked: true, total: 0, deliveryDays: 12, notes: 'Out-of-stock on whiteboard markers; partial shipment not possible.', submittedDaysAgo: 1, unitPrices: [295, 99, 230] },

    // RFQ-0004 (catering) — 1 quotation (accepted on auto-approval flow)
    { number: `Q-${year}-0006`, rfqNumber: `RFQ-${year}-0004`, vendorKey: 'evergreen', status: QuotationStatus.ACCEPTED, isLocked: true, total: 0, deliveryDays: 1, notes: 'Includes setup, buffet counters, and uniformed servers.', submittedDaysAgo: 3, unitPrices: [325, 425, 1750] },

    // RFQ-0005 (security) — 1 quotation (was accepted last month, PO already delivered)
    { number: `Q-${year}-0007`, rfqNumber: `RFQ-${year}-0005`, vendorKey: 'fortis', status: QuotationStatus.ACCEPTED, isLocked: true, total: 0, deliveryDays: 7, notes: 'PSARA-licensed. All guards verified. Includes weekly random audits.', submittedDaysAgo: 22, unitPrices: [27500, 31000, 44000] },

    // RFQ-0006 (monitors) — 2 quotations
    { number: `Q-${year}-0008`, rfqNumber: `RFQ-${year}-0006`, vendorKey: 'crescent', status: QuotationStatus.ACCEPTED, isLocked: true, total: 0, deliveryDays: 18, notes: 'Dell U2723QE, USB-C 90W power delivery, 3-year warranty.', submittedDaysAgo: 38, unitPrices: [23800] },
    { number: `Q-${year}-0009`, rfqNumber: `RFQ-${year}-0006`, vendorKey: 'acme',     status: QuotationStatus.REJECTED, isLocked: true, total: 0, deliveryDays: 14, notes: 'LG 27QN650, no USB-C; rejected on spec mismatch.', submittedDaysAgo: 36, unitPrices: [22100] },

    // RFQ-0008 (merchandise) — 2 quotations still open, will not be auto-shortlisted
    { number: `Q-${year}-0010`, rfqNumber: `RFQ-${year}-0008`, vendorKey: 'jade',      status: QuotationStatus.SUBMITTED, isLocked: false, total: 0, deliveryDays: 21, notes: 'Custom dye-sublimation print. MOQ: 100.', submittedDaysAgo: 1, unitPrices: [170, 88, 60, 215] },
    { number: `Q-${year}-0011`, rfqNumber: `RFQ-${year}-0008`, vendorKey: 'delhiprint', status: QuotationStatus.SUBMITTED, isLocked: false, total: 0, deliveryDays: 18, notes: 'UV print on cotton tote.', submittedDaysAgo: 1, unitPrices: [185, 92, 62, 225] },
  ];

  // Compute totals (now that we know RFQ line counts)
  for (const q of quotations) {
    const rfq = await prisma.rfq.findUniqueOrThrow({
      where: { number: q.rfqNumber },
      include: { lineItems: { orderBy: { lineNo: 'asc' } } },
    });
    if (q.unitPrices.length !== rfq.lineItems.length) {
      throw new Error(`Q ${q.number}: expected ${rfq.lineItems.length} prices, got ${q.unitPrices.length}`);
    }
    q.total = computeTotal(rfq.lineItems.map((li, i) => ({ unitPrice: q.unitPrices[i], quantity: Number(li.quantity) })));
  }

  const quotationByNumber = new Map<string, { id: string; status: QuotationStatus; total: number; vendorId: string; rfqId: string }>();
  for (const q of quotations) {
    const rfq = await prisma.rfq.findUniqueOrThrow({
      where: { number: q.rfqNumber },
      include: { lineItems: { orderBy: { lineNo: 'asc' } }, vendors: true },
    });
    const vendor = vendorByKey.get(q.vendorKey)!;
    const rfv = rfq.vendors.find((v) => v.vendorId === vendor.id);
    if (!rfv) throw new Error(`Vendor ${q.vendorKey} not invited to ${q.rfqNumber}`);

    const existing = await prisma.quotation.findUnique({ where: { number: q.number } });
    if (existing) {
      quotationByNumber.set(q.number, { id: existing.id, status: existing.status, total: Number(existing.totalAmount), vendorId: existing.vendorId, rfqId: existing.rfqId });
      continue;
    }

    const vendorUser = await prisma.user.findFirstOrThrow({ where: { vendorCompanyId: vendor.id, role: UserRole.VENDOR, status: UserStatus.ACTIVE } });
    const submittedAt = daysAgo(q.submittedDaysAgo);

    const newQ = await prisma.$transaction(async (tx) => {
      const newQ2 = await tx.quotation.create({
        data: {
          number: q.number,
          rfqId: rfq.id,
          rfqVendorId: rfv.id,
          vendorId: vendor.id,
          status: q.status,
          totalAmount: D(q.total),
          deliveryDate: daysAhead(q.submittedDaysAgo < 0 ? 0 : q.submittedDaysAgo + q.deliveryDays),
          notes: q.notes,
          isLocked: q.isLocked,
          submittedAt,
          submittedById: vendorUser.id,
          lineItems: {
            create: rfq.lineItems.map((li, i) => ({
              rfqLineItemId: li.id,
              unitPrice: D(q.unitPrices[i]),
              quantity: li.quantity,
              lineTotal: D(q.unitPrices[i] * Number(li.quantity)),
              createdById: vendorUser.id,
            })),
          },
        },
      });
      await tx.rfqVendor.update({ where: { id: rfv.id }, data: { status: RfqVendorStatus.RESPONDED, respondedAt: submittedAt } });
      await tx.auditLog.create({
        data: {
          action: AuditAction.QUOTATION_SUBMITTED,
          entityType: AuditEntityType.QUOTATION,
          entityId: newQ2.id,
          description: `Quotation submitted: ${newQ2.number} for RFQ ${rfq.number}`,
          metadata: { rfqId: rfq.id, rfqNumber: rfq.number, total: q.total } as Prisma.JsonObject,
          actorId: vendorUser.id,
          actorEmail: vendorUser.email,
          occurredAt: submittedAt,
        },
      });
      // Notify officers
      for (const off of [users.officer, users.priya]) {
        await tx.notification.create({
          data: {
            userId: off.id,
            type: NotificationType.QUOTATION_SUBMITTED,
            status: 'UNREAD',
            title: `New quotation: ${newQ2.number}`,
            message: `Quotation submitted on RFQ ${rfq.number} (total \u20B9${q.total.toFixed(2)}).`,
            entityType: 'QUOTATION',
            entityId: newQ2.id,
            createdAt: submittedAt,
          },
        });
      }
      if (q.status === QuotationStatus.SHORTLISTED) {
        await tx.auditLog.create({
          data: {
            action: AuditAction.QUOTATION_SHORTLISTED,
            entityType: AuditEntityType.QUOTATION,
            entityId: newQ2.id,
            description: `Quotation shortlisted: ${newQ2.number}`,
            metadata: { rfqId: rfq.id } as Prisma.JsonObject,
            actorId: users.officer.id,
            actorEmail: users.officer.email,
            occurredAt: submittedAt,
          },
        });
      }
      if (q.status === QuotationStatus.REJECTED) {
        await tx.auditLog.create({
          data: {
            action: AuditAction.QUOTATION_REJECTED,
            entityType: AuditEntityType.QUOTATION,
            entityId: newQ2.id,
            description: `Quotation rejected: ${newQ2.number} \u2014 ${q.notes}`,
            metadata: { remarks: q.notes } as Prisma.JsonObject,
            actorId: users.officer.id,
            actorEmail: users.officer.email,
            occurredAt: submittedAt,
          },
        });
      }
      return newQ2;
    });

    quotationByNumber.set(q.number, { id: newQ.id, status: newQ.status, total: q.total, vendorId: vendor.id, rfqId: rfq.id });
  }

  // -----------------------------------------------------------------
  // 6) APPROVALS + PO + INVOICE
  // -----------------------------------------------------------------
  // We replicate the EXACT logic in ApprovalsService.approve() so the
  // resulting data matches what the API would produce.
  console.log('\u2022 Creating approvals / POs / Invoices\u2026');

  const APPROVALS: Array<{
    quotationNumber: string;
    status: ApprovalStatus;
    requestedBy: string;            // user email (must NOT be the actor)
    actedBy: string;                // user email (manager / admin)
    remarks?: string;
    requestedDaysAgo: number;
    decidedDaysAgo?: number;        // for APPROVED / REJECTED
  }> = [
    { quotationNumber: `Q-${year}-0001`, status: ApprovalStatus.APPROVED, requestedBy: 'officer@vendorbridge.local', actedBy: 'manager@vendorbridge.local', remarks: 'Approved. Excellent price + warranty. Issue PO.', requestedDaysAgo: 3, decidedDaysAgo: 2 },
    { quotationNumber: `Q-${year}-0002`, status: ApprovalStatus.PENDING,  requestedBy: 'officer@vendorbridge.local', actedBy: 'manager@vendorbridge.local', requestedDaysAgo: 2 },
    { quotationNumber: `Q-${year}-0004`, status: ApprovalStatus.PENDING,  requestedBy: 'priya.officer@vendorbridge.local', actedBy: 'rohan.manager@vendorbridge.local', remarks: 'Better value for money vs other bids.', requestedDaysAgo: 1 },
    { quotationNumber: `Q-${year}-0005`, status: ApprovalStatus.REJECTED, requestedBy: 'priya.officer@vendorbridge.local', actedBy: 'manager@vendorbridge.local', remarks: 'Out of stock on markers \u2014 cannot fulfil full order.', requestedDaysAgo: 1, decidedDaysAgo: 0 },
    { quotationNumber: `Q-${year}-0006`, status: ApprovalStatus.APPROVED, requestedBy: 'priya.officer@vendorbridge.local', actedBy: 'manager@vendorbridge.local', remarks: 'Approved. Good dietary coverage.', requestedDaysAgo: 2, decidedDaysAgo: 2 },
    { quotationNumber: `Q-${year}-0007`, status: ApprovalStatus.APPROVED, requestedBy: 'officer@vendorbridge.local',      actedBy: 'manager@vendorbridge.local', remarks: 'PSARA-licensed and reviewed. Approved.', requestedDaysAgo: 21, decidedDaysAgo: 20 },
    { quotationNumber: `Q-${year}-0008`, status: ApprovalStatus.APPROVED, requestedBy: 'officer@vendorbridge.local',      actedBy: 'rohan.manager@vendorbridge.local', remarks: 'Approved. Spec-compliant.', requestedDaysAgo: 37, decidedDaysAgo: 36 },
  ];

  for (const ap of APPROVALS) {
    const existing = await prisma.approval.findUnique({ where: { quotationId: quotationByNumber.get(ap.quotationNumber)!.id } });
    if (existing) continue;
    await createApproval(ap);
  }

  // -----------------------------------------------------------------
  // 7) Make a couple of POs DELIVERED + mark invoices PAID for history
  // -----------------------------------------------------------------
  console.log('\u2022 Marking delivered + paid for historical POs\u2026');
  const pos = await prisma.purchaseOrder.findMany({ include: { invoice: true } });
  for (const po of pos) {
    const targetQuotation = await prisma.quotation.findUnique({ where: { id: po.quotationId } });
    if (!targetQuotation) continue;
    // Older POs (from quotations Q-0007, Q-0008) should be DELIVERED + PAID
    if (['Q-' + year + '-0007', 'Q-' + year + '-0008'].includes(targetQuotation.number)) {
      if (po.status === PoStatus.GENERATED) {
        const sentAt = po.generatedAt;
        await advancePo(po.id, PoStatus.SENT, users.officer, sentAt, daysAgo(15));
        await advancePo(po.id, PoStatus.DELIVERED, users.officer, daysAgo(15), daysAgo(2));
      }
      if (po.invoice && po.invoice.status === InvoiceStatus.PENDING) {
        await markInvoicePaid(po.invoice.id, users.officer);
      }
    }
  }

  // Make one invoice OVERDUE
  console.log('\u2022 Marking one invoice as overdue\u2026');
  const pendingInvoices = await prisma.invoice.findMany({ where: { status: InvoiceStatus.PENDING } });
  if (pendingInvoices.length > 0) {
    const target = pendingInvoices[0];
    await prisma.invoice.update({
      where: { id: target.id },
      data: {
        overdueAt: daysAgo(5),
        status: InvoiceStatus.OVERDUE,
      },
    });
    await prisma.invoiceStatusEvent.create({
      data: {
        invoiceId: target.id,
        fromStatus: InvoiceStatus.PENDING,
        toStatus: InvoiceStatus.OVERDUE,
        note: 'Auto-sweep: invoice overdue',
        actorId: users.officer.id,
        occurredAt: daysAgo(5),
      },
    });
    await prisma.auditLog.create({
      data: {
        action: AuditAction.INVOICE_OVERDUE,
        entityType: AuditEntityType.INVOICE,
        entityId: target.id,
        description: `Invoice marked overdue: ${target.number}`,
        actorId: users.officer.id,
        actorEmail: users.officer.email,
        occurredAt: daysAgo(5),
      },
    });
  }

  // -----------------------------------------------------------------
  // 8) HISTORICAL INVOICES for reports (paid across the last 30 days)
  // -----------------------------------------------------------------
  console.log('\u2022 Creating historical invoice history (last 30 days)\u2026');
  await backfillHistoricalInvoices();

  // -----------------------------------------------------------------
  // Done
  // -----------------------------------------------------------------
  console.log('\n\u2705 Seed complete.\n');
  console.log('--- Login credentials (password: "Password123!") ---');
  for (const u of [
    { email: 'admin@vendorbridge.local',               name: 'System Admin',         role: 'ADMIN' },
    { email: 'officer@vendorbridge.local',             name: 'Olivia Officer',       role: 'OFFICER' },
    { email: 'priya.officer@vendorbridge.local',       name: 'Priya Procurement',    role: 'OFFICER' },
    { email: 'manager@vendorbridge.local',             name: 'Maya Manager',         role: 'MANAGER' },
    { email: 'rohan.manager@vendorbridge.local',       name: 'Rohan Reviewer',       role: 'MANAGER' },
    { email: 'vendor@acme.example',                    name: 'Aman Acme',            role: 'VENDOR (Acme)' },
    { email: 'sales@acme.example',                     name: 'Anita Acme',           role: 'VENDOR (Acme)' },
    { email: 'vendor@bluepeak.example',                name: 'Bina Bluepeak',        role: 'VENDOR (Bluepeak)' },
    { email: 'vendor@crescentit.example',              name: 'Chirag Crescent',      role: 'VENDOR (Crescent IT)' },
    { email: 'vendor@delhiprint.example',              name: 'Deepa Delhi',          role: 'VENDOR (Delhi Print)' },
    { email: 'vendor@evergreen.example',               name: 'Esha Evergreen',       role: 'VENDOR (Evergreen)' },
    { email: 'vendor@fortissec.example',               name: 'Faisal Fortis',        role: 'VENDOR (Fortis)' },
    { email: 'vendor@globex.example',                  name: 'Gaurav Globex',        role: 'VENDOR (Globex \u2014 PENDING)' },
    { email: 'vendor@horizonpower.example',            name: 'Hari Horizon',         role: 'VENDOR (Horizon \u2014 INACTIVE)' },
    { email: 'vendor@indusfacility.example',           name: 'Ishan Indus',          role: 'VENDOR (Indus \u2014 BLOCKED)' },
    { email: 'vendor@jade.example',                    name: 'Jaya Jade',            role: 'VENDOR (Jade)' },
  ]) {
    console.log(`  ${u.role.padEnd(22)} ${u.email}`);
  }

  async function upsertUser(email: string, fullName: string, role: UserRole, passwordHash: string, extra: { phone?: string } = {}) {
    return prisma.user.upsert({
      where: { email },
      update: { fullName, role, status: UserStatus.ACTIVE, ...(extra.phone ? { phone: extra.phone } : {}) },
      create: { email, fullName, role, status: UserStatus.ACTIVE, passwordHash, ...(extra.phone ? { phone: extra.phone } : {}) },
    });
  }

  // Create an approval + the resulting PO/Invoice chain.
  async function createApproval(ap: typeof APPROVALS[number]) {
    const requester = await prisma.user.findUniqueOrThrow({ where: { email: ap.requestedBy } });
    const actor = await prisma.user.findUniqueOrThrow({ where: { email: ap.actedBy } });
    if (ap.status !== ApprovalStatus.PENDING && requester.id === actor.id) {
      throw new Error(`SoD violation: requester and actor cannot be the same (${ap.quotationNumber})`);
    }
    const quotation = await prisma.quotation.findUniqueOrThrow({
      where: { number: ap.quotationNumber },
      include: { lineItems: true, vendor: true, rfq: true },
    });

    const requestedAt = daysAgo(ap.requestedDaysAgo);
    const decidedAt = ap.decidedDaysAgo != null ? daysAgo(ap.decidedDaysAgo) : null;

    // ---------- PENDING: just create approval + audit + notify ----------
    if (ap.status === ApprovalStatus.PENDING) {
      await prisma.$transaction(async (tx) => {
        const a = await tx.approval.create({
          data: {
            rfqId: quotation.rfqId,
            quotationId: quotation.id,
            status: ApprovalStatus.PENDING,
            remarks: ap.remarks ?? null,
            requestedById: requester.id,
            requestedAt,
          },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.APPROVAL_REQUESTED,
            entityType: AuditEntityType.APPROVAL,
            entityId: a.id,
            description: `Approval requested for ${quotation.number}`,
            metadata: { quotationId: quotation.id, rfqId: quotation.rfqId } as Prisma.JsonObject,
            actorId: requester.id,
            actorEmail: requester.email,
            occurredAt: requestedAt,
          },
        });
        for (const m of [users.manager, users.rohan]) {
          await tx.notification.create({
            data: {
              userId: m.id,
              type: NotificationType.APPROVAL_REQUESTED,
              status: 'UNREAD',
              title: `Approval requested: ${quotation.number}`,
              message: `An approval is awaiting your decision.`,
              entityType: 'APPROVAL',
              entityId: a.id,
              createdAt: requestedAt,
            },
          });
        }
      });
      return;
    }

    // ---------- REJECTED: mark approval rejected + revert quotation + audit + notify ----------
    if (ap.status === ApprovalStatus.REJECTED) {
      await prisma.$transaction(async (tx) => {
        const a = await tx.approval.create({
          data: {
            rfqId: quotation.rfqId,
            quotationId: quotation.id,
            status: ApprovalStatus.REJECTED,
            remarks: ap.remarks ?? 'No remarks',
            requestedById: requester.id,
            requestedAt,
            decidedAt: decidedAt!,
            actedById: actor.id,
          },
        });
        await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: QuotationStatus.SUBMITTED, isLocked: false },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.APPROVAL_REQUESTED,
            entityType: AuditEntityType.APPROVAL,
            entityId: a.id,
            description: `Approval requested for ${quotation.number}`,
            metadata: { quotationId: quotation.id, rfqId: quotation.rfqId } as Prisma.JsonObject,
            actorId: requester.id,
            actorEmail: requester.email,
            occurredAt: requestedAt,
          },
        });
        await tx.auditLog.create({
          data: {
            action: AuditAction.APPROVAL_REJECTED,
            entityType: AuditEntityType.APPROVAL,
            entityId: a.id,
            description: `Approval rejected: ${ap.remarks ?? 'No remarks'}`,
            metadata: { remarks: ap.remarks ?? '' } as Prisma.JsonObject,
            actorId: actor.id,
            actorEmail: actor.email,
            occurredAt: decidedAt!,
          },
        });
        await tx.notification.create({
          data: {
            userId: requester.id,
            type: NotificationType.APPROVAL_REJECTED,
            status: 'UNREAD',
            title: 'Approval rejected',
            message: ap.remarks ?? 'No remarks',
            entityType: 'APPROVAL',
            entityId: a.id,
            createdAt: decidedAt!,
          },
        });
      });
      return;
    }

    // ---------- APPROVED: full chain (PO + Invoice + close RFQ + audit + notify) ----------
    if (ap.status === ApprovalStatus.APPROVED) {
      const taxRate = 18;
      const subtotal = quotation.totalAmount;
      const taxAmount = D(Number(subtotal) * taxRate / 100);
      const grandTotal = D(Number(subtotal) + Number(taxAmount));
      const dueDate = new Date(decidedAt!);
      dueDate.setUTCDate(dueDate.getUTCDate() + 30);

      await prisma.$transaction(async (tx) => {
        const a = await tx.approval.create({
          data: {
            rfqId: quotation.rfqId,
            quotationId: quotation.id,
            status: ApprovalStatus.APPROVED,
            remarks: ap.remarks ?? null,
            requestedById: requester.id,
            requestedAt,
            decidedAt: decidedAt!,
            actedById: actor.id,
          },
        });

        const updatedQ = await tx.quotation.update({
          where: { id: quotation.id },
          data: { status: QuotationStatus.ACCEPTED, isLocked: true },
        });
        void updatedQ;

        const po = await tx.purchaseOrder.create({
          data: {
            number: await nextNumber('PO', tx),
            approvalId: a.id,
            vendorId: quotation.vendorId,
            quotationId: quotation.id,
            status: PoStatus.GENERATED,
            totalAmount: subtotal,
            taxRatePercent: D(taxRate),
            taxAmount,
            grandTotal,
            currency: 'INR',
            createdById: actor.id,
            generatedAt: decidedAt!,
            lineItems: {
              create: quotation.lineItems.map((li, idx) => ({
                lineNo: idx + 1,
                description: `Item ${idx + 1}`,
                quantity: li.quantity,
                unit: 'EA',
                unitPrice: li.unitPrice,
                lineTotal: li.lineTotal,
              })),
            },
            statusEvents: {
              create: {
                fromStatus: PoStatus.GENERATED,
                toStatus: PoStatus.GENERATED,
                note: 'Auto-generated on approval',
                actorId: actor.id,
                occurredAt: decidedAt!,
              },
            },
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            number: await nextNumber('INV', tx),
            purchaseOrderId: po.id,
            approvalId: a.id,
            vendorId: quotation.vendorId,
            status: InvoiceStatus.PENDING,
            subtotal,
            taxRatePercent: D(taxRate),
            taxAmount,
            grandTotal,
            currency: 'INR',
            dueDate,
            createdById: actor.id,
            createdAt: decidedAt!,
            lineItems: {
              create: quotation.lineItems.map((li, idx) => ({
                lineNo: idx + 1,
                description: `Item ${idx + 1}`,
                quantity: li.quantity,
                unitPrice: li.unitPrice,
                lineTotal: li.lineTotal,
              })),
            },
            statusEvents: {
              create: {
                fromStatus: InvoiceStatus.PENDING,
                toStatus: InvoiceStatus.PENDING,
                note: 'Auto-generated on approval',
                actorId: actor.id,
                occurredAt: decidedAt!,
              },
            },
          },
        });

        // Lock other quotations + close RFQ
        await tx.quotation.updateMany({
          where: { rfqId: quotation.rfqId, NOT: { id: quotation.id } },
          data: { isLocked: true },
        });
        await tx.rfq.update({ where: { id: quotation.rfqId }, data: { status: RfqStatus.CLOSED, closedAt: decidedAt! } });

        // Audit trail
        for (const log of [
          { action: AuditAction.APPROVAL_REQUESTED, entityType: AuditEntityType.APPROVAL, entityId: a.id, desc: `Approval requested for ${quotation.number}`, actorId: requester.id, actorEmail: requester.email, occurredAt: requestedAt, meta: { quotationId: quotation.id, rfqId: quotation.rfqId } as Prisma.JsonObject },
          { action: AuditAction.APPROVAL_APPROVED, entityType: AuditEntityType.APPROVAL, entityId: a.id, desc: `Approval approved: quotation ${quotation.number}`, actorId: actor.id, actorEmail: actor.email, occurredAt: decidedAt!, meta: { quotationId: quotation.id, poId: po.id, invoiceId: invoice.id } as Prisma.JsonObject },
          { action: AuditAction.PO_GENERATED, entityType: AuditEntityType.PURCHASE_ORDER, entityId: po.id, desc: `PO generated: ${po.number}`, actorId: actor.id, actorEmail: actor.email, occurredAt: decidedAt!, meta: { number: po.number, quotationId: quotation.id, vendorId: quotation.vendorId } as Prisma.JsonObject },
          { action: AuditAction.INVOICE_GENERATED, entityType: AuditEntityType.INVOICE, entityId: invoice.id, desc: `Invoice generated: ${invoice.number}`, actorId: actor.id, actorEmail: actor.email, occurredAt: decidedAt!, meta: { number: invoice.number, poId: po.id } as Prisma.JsonObject },
          { action: AuditAction.RFQ_CLOSED, entityType: AuditEntityType.RFQ, entityId: quotation.rfqId, desc: 'RFQ auto-closed on approval', actorId: actor.id, actorEmail: actor.email, occurredAt: decidedAt!, meta: undefined },
        ]) {
          await tx.auditLog.create({ data: { action: log.action, entityType: log.entityType, entityId: log.entityId, description: log.desc, metadata: log.meta, actorId: log.actorId, actorEmail: log.actorEmail, occurredAt: log.occurredAt } });
        }

        // Notifications
        await tx.notification.create({ data: { userId: requester.id, type: NotificationType.APPROVAL_APPROVED, status: 'UNREAD', title: `Approval approved: ${quotation.number}`, message: `PO ${po.number} and Invoice ${invoice.number} generated.`, entityType: 'APPROVAL', entityId: a.id, createdAt: decidedAt! } });
        const vendorUsers = await tx.user.findMany({ where: { vendorCompanyId: quotation.vendorId }, select: { id: true } });
        for (const vu of vendorUsers) {
          await tx.notification.create({ data: { userId: vu.id, type: NotificationType.PO_GENERATED, status: 'UNREAD', title: `New PO: ${po.number}`, message: `PO issued for ${quotation.number}.`, entityType: 'PURCHASE_ORDER', entityId: po.id, createdAt: decidedAt! } });
          await tx.notification.create({ data: { userId: vu.id, type: NotificationType.INVOICE_GENERATED, status: 'UNREAD', title: `New Invoice: ${invoice.number}`, message: `Invoice generated. Due ${invoice.dueDate.toISOString().substring(0, 10)}.`, entityType: 'INVOICE', entityId: invoice.id, createdAt: decidedAt! } });
        }
      });
      return;
    }
  }

  async function advancePo(poId: string, to: PoStatus, actor: { id: string; email: string }, at: Date, occurredAt: Date) {
    const po = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    const from = po.status;
    await prisma.$transaction(async (tx) => {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: to, ...(to === PoStatus.SENT ? { sentAt: occurredAt } : {}), ...(to === PoStatus.DELIVERED ? { deliveredAt: occurredAt } : {}) },
      });
      await tx.poStatusEvent.create({ data: { purchaseOrderId: po.id, fromStatus: from, toStatus: to, actorId: actor.id, occurredAt } });
      await tx.auditLog.create({ data: { action: to === PoStatus.SENT ? AuditAction.PO_SENT : AuditAction.PO_DELIVERED, entityType: AuditEntityType.PURCHASE_ORDER, entityId: po.id, description: `PO ${to.toLowerCase()}: ${po.number}`, actorId: actor.id, actorEmail: actor.email, occurredAt } });
      if (to === PoStatus.SENT) {
        const vendorUsers = await tx.user.findMany({ where: { vendorCompanyId: po.vendorId }, select: { id: true } });
        for (const vu of vendorUsers) {
          await tx.notification.create({ data: { userId: vu.id, type: NotificationType.PO_SENT, status: 'UNREAD', title: `PO sent: ${po.number}`, message: 'Purchase order has been sent.', entityType: 'PURCHASE_ORDER', entityId: po.id, createdAt: occurredAt } });
        }
      }
    });
    void at;
  }

  async function markInvoicePaid(invoiceId: string, actor: { id: string; email: string }) {
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    const paidAt = daysAgo(1);
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: inv.id }, data: { status: InvoiceStatus.PAID, paidAt } });
      await tx.invoiceStatusEvent.create({ data: { invoiceId: inv.id, fromStatus: InvoiceStatus.PENDING, toStatus: InvoiceStatus.PAID, note: 'Marked paid (seed)', actorId: actor.id, occurredAt: paidAt } });
      await tx.payment.create({ data: { invoiceId: inv.id, amount: inv.grandTotal, method: PaymentMethod.BANK_TRANSFER, reference: 'TXN' + Math.floor(Math.random() * 9_000_000 + 1_000_000), notes: 'Seed payment', recordedById: actor.id, paidAt } });
      await tx.auditLog.create({ data: { action: AuditAction.INVOICE_PAID, entityType: AuditEntityType.INVOICE, entityId: inv.id, description: `Invoice paid: ${inv.number}`, actorId: actor.id, actorEmail: actor.email, occurredAt: paidAt } });
    });
  }

  // Allocate the next sequence number for PO/INV/RFQ/Q.
  async function nextNumber(prefix: string, tx: Prisma.TransactionClient): Promise<string> {
    const seq = await tx.sequenceTracker.upsert({
      where: { id_year: { id: prefix, year } },
      update: { lastValue: { increment: 1 } },
      create: { id: prefix, year, lastValue: 1 },
    });
    return `${prefix}-${seq.year}-${String(seq.lastValue).padStart(4, '0')}`;
  }

  // Past-dated paid invoices for the reports.
  // Each entry gets its own fresh RFQ + Quotation + Approval + PO + Invoice chain
  // (because Invoice.purchaseOrderId and Invoice.approvalId are @unique, and
  // Approval.quotationId is also @unique, so we cannot reuse a quotation across
  // multiple historical invoices for the same vendor).
  async function backfillHistoricalInvoices() {
    const plan: Array<{ vendorKey: string; monthAgo: number; dayOfMonth: number; base: number; tax: number; suffix: number; title: string }> = [
      { vendorKey: 'crescent',  monthAgo: 1, dayOfMonth: 5,  base: 180000, tax: 32400, suffix: 9001, title: 'Server hardware refresh (historical)' },
      { vendorKey: 'crescent',  monthAgo: 1, dayOfMonth: 18, base:  96000, tax: 17280, suffix: 9002, title: 'Network switch upgrade (historical)' },
      { vendorKey: 'acme',      monthAgo: 1, dayOfMonth: 9,  base: 145000, tax: 26100, suffix: 9003, title: 'Office furniture phase 2 (historical)' },
      { vendorKey: 'fortis',    monthAgo: 1, dayOfMonth: 2,  base: 198000, tax: 35640, suffix: 9004, title: 'Annual security contract (historical)' },
      { vendorKey: 'fortis',    monthAgo: 2, dayOfMonth: 2,  base: 198000, tax: 35640, suffix: 9005, title: 'Annual security contract (historical)' },
      { vendorKey: 'fortis',    monthAgo: 3, dayOfMonth: 2,  base: 198000, tax: 35640, suffix: 9006, title: 'Annual security contract (historical)' },
      { vendorKey: 'evergreen', monthAgo: 1, dayOfMonth: 12, base:  78000, tax: 14040, suffix: 9007, title: 'HVAC maintenance (historical)' },
      { vendorKey: 'jade',      monthAgo: 1, dayOfMonth: 22, base:  42000, tax:  7560, suffix: 9008, title: 'Stationery & consumables (historical)' },
      { vendorKey: 'crescent',  monthAgo: 0, dayOfMonth: 3,  base:  86000, tax: 15480, suffix: 9009, title: 'Cloud storage top-up (historical)' },
    ];

    for (const p of plan) {
      const invNumber = `INV-${year}-${p.suffix}`;
      const existing = await prisma.invoice.findUnique({ where: { number: invNumber } });
      if (existing) continue;
      const vendor = vendorByKey.get(p.vendorKey);
      if (!vendor) continue;

      const issued = new Date();
      issued.setUTCMonth(issued.getUTCMonth() - p.monthAgo);
      issued.setUTCDate(p.dayOfMonth);
      const due = new Date(issued);
      due.setUTCDate(due.getUTCDate() + 30);
      const paid = new Date(issued);
      paid.setUTCDate(paid.getUTCDate() + 18);

      const rfqNumber = `RFQ-${year}-${p.suffix}`;
      const qNumber = `Q-${year}-${p.suffix}`;
      const poNumber = `PO-${year}-${p.suffix}`;

      const firstVendorUser = await prisma.user.findFirst({ where: { vendorCompanyId: vendor.id }, orderBy: { createdAt: 'asc' } });
      const vendorUserId = firstVendorUser?.id ?? users.admin.id;
      const vendorUserEmail = firstVendorUser?.email ?? users.admin.email;

      await prisma.$transaction(async (tx) => {
        // 1) Fresh historical RFQ (closed), with this vendor invited.
        const rfq = await tx.rfq.create({
          data: {
            number: rfqNumber,
            title: p.title,
            description: 'Historical backfill record for reporting and analytics.',
            status: RfqStatus.CLOSED,
            deadline: new Date(issued.getTime() - 7 * 24 * 60 * 60 * 1000),
            publishedAt: new Date(issued.getTime() - 14 * 24 * 60 * 60 * 1000),
            closedAt: new Date(issued.getTime() - 5 * 24 * 60 * 60 * 1000),
            createdById: users.officer.id,
            createdAt: new Date(issued.getTime() - 14 * 24 * 60 * 60 * 1000),
          },
        });
        await tx.rfqLineItem.create({
          data: {
            rfqId: rfq.id,
            lineNo: 1,
            description: 'Historical seed line',
            quantity: D(1),
            unit: 'EA',
            targetUnitPrice: D(p.base),
            createdById: users.officer.id,
          },
        });
        const rfv = await tx.rfqVendor.create({
          data: { rfqId: rfq.id, vendorId: vendor.id, status: RfqVendorStatus.RESPONDED, invitedAt: new Date(issued.getTime() - 14 * 24 * 60 * 60 * 1000), respondedAt: new Date(issued.getTime() - 10 * 24 * 60 * 60 * 1000) },
        });
        const rfqLine = await tx.rfqLineItem.findFirstOrThrow({ where: { rfqId: rfq.id } });

        // 2) Quotation.
        const q = await tx.quotation.create({
          data: {
            rfqId: rfq.id,
            rfqVendorId: rfv.id,
            vendorId: vendor.id,
            number: qNumber,
            status: QuotationStatus.ACCEPTED,
            totalAmount: D(p.base),
            isLocked: true,
            submittedById: vendorUserId,
            submittedAt: new Date(issued.getTime() - 10 * 24 * 60 * 60 * 1000),
            lineItems: { create: [{ rfqLineItemId: rfqLine.id, unitPrice: D(p.base), quantity: D(1), lineTotal: D(p.base), createdById: vendorUserId }] },
          },
        });

        // 3) Approval (APPROVED, terminal).
        const ap = await tx.approval.create({
          data: {
            rfqId: rfq.id,
            quotationId: q.id,
            status: ApprovalStatus.APPROVED,
            remarks: 'Historical seed approval',
            requestedById: users.officer.id,
            requestedAt: new Date(issued.getTime() - 9 * 24 * 60 * 60 * 1000),
            decidedAt: issued,
            actedById: users.manager.id,
          },
        });

        // 4) Purchase Order (DELIVERED, all timestamps backdated).
        const po = await tx.purchaseOrder.create({
          data: {
            number: poNumber,
            approvalId: ap.id,
            vendorId: vendor.id,
            quotationId: q.id,
            status: PoStatus.DELIVERED,
            totalAmount: D(p.base),
            taxRatePercent: D(18),
            taxAmount: D(p.tax),
            grandTotal: D(p.base + p.tax),
            currency: 'INR',
            createdById: users.manager.id,
            generatedAt: issued,
            sentAt: issued,
            deliveredAt: paid,
            lineItems: { create: [{ lineNo: 1, description: 'Historical seed line', quantity: D(1), unit: 'EA', unitPrice: D(p.base), lineTotal: D(p.base) }] },
            statusEvents: {
              create: [
                { fromStatus: PoStatus.GENERATED, toStatus: PoStatus.GENERATED, actorId: users.manager.id, occurredAt: issued },
                { fromStatus: PoStatus.GENERATED, toStatus: PoStatus.SENT, actorId: users.officer.id, occurredAt: issued },
                { fromStatus: PoStatus.SENT, toStatus: PoStatus.DELIVERED, actorId: users.officer.id, occurredAt: paid },
              ],
            },
          },
        });

        // 5) Invoice (PAID, backdated).
        const inv = await tx.invoice.create({
          data: {
            number: invNumber,
            purchaseOrderId: po.id,
            approvalId: ap.id,
            vendorId: vendor.id,
            status: InvoiceStatus.PAID,
            subtotal: D(p.base),
            taxRatePercent: D(18),
            taxAmount: D(p.tax),
            grandTotal: D(p.base + p.tax),
            currency: 'INR',
            issueDate: issued,
            dueDate: due,
            paidAt: paid,
            createdById: users.manager.id,
            createdAt: issued,
            lineItems: { create: [{ lineNo: 1, description: 'Historical seed line', quantity: D(1), unitPrice: D(p.base), lineTotal: D(p.base) }] },
            statusEvents: {
              create: [
                { fromStatus: InvoiceStatus.PENDING, toStatus: InvoiceStatus.PENDING, actorId: users.manager.id, occurredAt: issued },
                { fromStatus: InvoiceStatus.PENDING, toStatus: InvoiceStatus.PAID, actorId: users.officer.id, occurredAt: paid },
              ],
            },
            payments: { create: [{ amount: D(p.base + p.tax), method: PaymentMethod.BANK_TRANSFER, reference: 'SEED' + Math.floor(Math.random() * 9_000_000 + 1_000_000), recordedById: users.officer.id, paidAt: paid, notes: 'Historical seed payment' }] },
          },
        });

        // 6) Audit log entries.
        await tx.auditLog.create({ data: { action: AuditAction.RFQ_CREATED, entityType: AuditEntityType.RFQ, entityId: rfq.id, description: `RFQ created: ${rfq.number}`, actorId: users.officer.id, actorEmail: users.officer.email, occurredAt: new Date(issued.getTime() - 14 * 24 * 60 * 60 * 1000) } });
        await tx.auditLog.create({ data: { action: AuditAction.RFQ_PUBLISHED, entityType: AuditEntityType.RFQ, entityId: rfq.id, description: `RFQ published: ${rfq.number}`, actorId: users.officer.id, actorEmail: users.officer.email, occurredAt: new Date(issued.getTime() - 14 * 24 * 60 * 60 * 1000) } });
        await tx.auditLog.create({ data: { action: AuditAction.QUOTATION_SUBMITTED, entityType: AuditEntityType.QUOTATION, entityId: q.id, description: `Quotation submitted: ${q.number}`, actorId: vendorUserId, actorEmail: vendorUserEmail, occurredAt: new Date(issued.getTime() - 10 * 24 * 60 * 60 * 1000) } });
        await tx.auditLog.create({ data: { action: AuditAction.APPROVAL_APPROVED, entityType: AuditEntityType.APPROVAL, entityId: ap.id, description: `Approval approved (historical): ${q.number}`, actorId: users.manager.id, actorEmail: users.manager.email, occurredAt: issued } });
        await tx.auditLog.create({ data: { action: AuditAction.PO_GENERATED, entityType: AuditEntityType.PURCHASE_ORDER, entityId: po.id, description: `PO generated: ${po.number}`, actorId: users.manager.id, actorEmail: users.manager.email, occurredAt: issued } });
        await tx.auditLog.create({ data: { action: AuditAction.INVOICE_GENERATED, entityType: AuditEntityType.INVOICE, entityId: inv.id, description: `Invoice generated: ${inv.number}`, actorId: users.manager.id, actorEmail: users.manager.email, occurredAt: issued } });
        await tx.auditLog.create({ data: { action: AuditAction.INVOICE_PAID, entityType: AuditEntityType.INVOICE, entityId: inv.id, description: `Invoice paid: ${inv.number}`, actorId: users.officer.id, actorEmail: users.officer.email, occurredAt: paid } });
      });
    }

    // Bump sequence counters past the 9000 range so future user-created docs
    // start at 0001 cleanly.
    for (const id of ['rfq', 'quotation', 'purchase_order', 'invoice']) {
      await prisma.sequenceTracker.upsert({
        where: { id_year: { id, year } },
        update: { lastValue: 9000 },
        create: { id, year, lastValue: 9000 },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
