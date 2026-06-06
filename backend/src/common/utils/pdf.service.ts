import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

interface LineItemShape {
  lineNo: number;
  description: string;
  quantity: { toString(): string } | string | number;
  unit?: string;
  unitPrice: { toString(): string } | string | number;
  lineTotal: { toString(): string } | string | number;
}

interface PoShape {
  number: string;
  generatedAt: Date;
  status: string;
  totalAmount: { toString(): string } | string | number;
  taxRatePercent: { toString(): string } | string | number;
  taxAmount: { toString(): string } | string | number;
  grandTotal: { toString(): string } | string | number;
  currency: string;
  notes?: string | null;
  vendor: { displayName: string; legalName: string; contactEmail: string; contactPhone?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
  lineItems: LineItemShape[];
  approval?: { quotation?: { rfq?: { number: string; title: string } } };
}

interface InvoiceShape {
  number: string;
  createdAt: Date;
  dueDate: Date;
  status: string;
  subtotal: { toString(): string } | string | number;
  taxRatePercent: { toString(): string } | string | number;
  taxAmount: { toString(): string } | string | number;
  grandTotal: { toString(): string } | string | number;
  currency: string;
  notes?: string | null;
  vendor: { displayName: string; legalName: string; contactEmail: string; contactPhone?: string | null; addressLine1?: string | null; city?: string | null; state?: string | null; postalCode?: string | null; country?: string | null };
  purchaseOrder: { number: string };
  lineItems: LineItemShape[];
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  renderPurchaseOrder(po: PoShape): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this.renderHeader(doc, `PURCHASE ORDER`, po.number);
        this.renderVendorBlock(doc, po.vendor);
        this.renderMeta(doc, [
          ['Status', po.status],
          ['Generated', po.generatedAt.toISOString().substring(0, 10)],
          ['RFQ', po.approval?.quotation?.rfq?.number ?? '—'],
        ]);
        this.renderLineItems(doc, po.lineItems, po.currency);
        this.renderTotals(doc, [
          ['Subtotal', fmt(po.totalAmount)],
          [`Tax (${po.taxRatePercent}%)`, fmt(po.taxAmount)],
          ['Grand Total', fmt(po.grandTotal)],
        ]);
        if (po.notes) doc.text(`Notes: ${po.notes}`, { align: 'left' });
        this.renderFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  renderInvoice(inv: InvoiceShape): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this.renderHeader(doc, `INVOICE`, inv.number);
        this.renderVendorBlock(doc, inv.vendor);
        this.renderMeta(doc, [
          ['Status', inv.status],
          ['Issued', inv.createdAt.toISOString().substring(0, 10)],
          ['Due', inv.dueDate.toISOString().substring(0, 10)],
          ['PO Ref', inv.purchaseOrder.number],
        ]);
        this.renderLineItems(doc, inv.lineItems, inv.currency);
        this.renderTotals(doc, [
          ['Subtotal', fmt(inv.subtotal)],
          [`Tax (${inv.taxRatePercent}%)`, fmt(inv.taxAmount)],
          ['Grand Total', fmt(inv.grandTotal)],
        ]);
        if (inv.notes) doc.text(`Notes: ${inv.notes}`, { align: 'left' });
        this.renderFooter(doc);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ---- shared layout helpers ----
  private renderHeader(doc: PDFKit.PDFDocument, title: string, number: string) {
    doc
      .fontSize(20).text(title, { align: 'right' })
      .fontSize(10).fillColor('#666').text(`#${number}`, { align: 'right' })
      .moveDown(0.5)
      .fillColor('#000');
    doc.fontSize(16).text('VendorBridge', { align: 'left' });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ccc').stroke();
    doc.moveDown(1);
  }

  private renderVendorBlock(doc: PDFKit.PDFDocument, v: PoShape['vendor']) {
    doc.fontSize(11).fillColor('#000').text('Vendor', { underline: true });
    doc.fontSize(10).fillColor('#333');
    doc.text(v.legalName);
    if (v.addressLine1) doc.text(v.addressLine1);
    const cityLine = [v.city, v.state, v.postalCode, v.country].filter(Boolean).join(', ');
    if (cityLine) doc.text(cityLine);
    doc.text(v.contactEmail);
    if (v.contactPhone) doc.text(v.contactPhone);
    doc.moveDown(1);
  }

  private renderMeta(doc: PDFKit.PDFDocument, rows: [string, string][]) {
    doc.fontSize(10).fillColor('#000');
    const startY = doc.y;
    rows.forEach(([k, v], i) => {
      doc.text(`${k}:`, 350, startY + i * 14, { continued: false });
      doc.text(v, 430, startY + i * 14);
    });
    doc.y = startY + rows.length * 14 + 8;
  }

  private renderLineItems(doc: PDFKit.PDFDocument, items: LineItemShape[], currency: string) {
    const startY = doc.y;
    const cols = [
      { label: '#', x: 50, w: 20 },
      { label: 'Description', x: 70, w: 220 },
      { label: 'Qty', x: 290, w: 50, align: 'right' as const },
      { label: 'Unit Price', x: 340, w: 100, align: 'right' as const },
      { label: 'Total', x: 440, w: 105, align: 'right' as const },
    ];
    doc.fontSize(10).fillColor('#000');
    cols.forEach((c) => doc.text(c.label, c.x, startY, { width: c.w, align: c.align ?? 'left' }));
    doc.moveTo(50, startY + 14).lineTo(545, startY + 14).strokeColor('#999').stroke();
    let y = startY + 22;
    doc.fillColor('#222');
    for (const li of items) {
      const descText = String(li.description || '');
      const hDesc = doc.heightOfString(descText, { width: cols[1].w });
      const rowHeight = Math.max(hDesc, 14) + 8;
      
      // Check for page break
      if (y + rowHeight > doc.page.height - 70) {
        doc.addPage();
        y = 50;
      }

      doc.text(String(li.lineNo), cols[0].x, y, { width: cols[0].w });
      doc.text(descText, cols[1].x, y, { width: cols[1].w });
      doc.text(fmt(li.quantity), cols[2].x, y, { width: cols[2].w, align: 'right' });
      doc.text(`${currency} ${fmt(li.unitPrice)}`, cols[3].x, y, { width: cols[3].w, align: 'right' });
      doc.text(`${currency} ${fmt(li.lineTotal)}`, cols[4].x, y, { width: cols[4].w, align: 'right' });
      y += rowHeight;
    }
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ccc').stroke();
    doc.y = y + 8;
  }

  private renderTotals(doc: PDFKit.PDFDocument, rows: [string, string][]) {
    const startY = doc.y;
    const labelX = 330;
    const valueX = 440;
    rows.forEach(([k, v], i) => {
      const y = startY + i * 16;
      doc.fontSize(10).fillColor('#000').text(k, labelX, y, { width: 100, align: 'right' });
      doc.fontSize(i === rows.length - 1 ? 12 : 10).fillColor('#000').text(v, valueX, y, { width: 105, align: 'right' });
    });
    doc.y = startY + rows.length * 16 + 10;
  }

  private renderFooter(doc: PDFKit.PDFDocument) {
    const range = doc.bufferedPageRange ? doc.bufferedPageRange() : { start: 0, count: 1 };
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const bottom = doc.page.height - 40;
      doc.fontSize(8).fillColor('#999')
        .text(`Generated by VendorBridge on ${new Date().toISOString()}`, 50, bottom, { align: 'center', width: 495 });
    }
  }
}

function fmt(v: unknown): string {
  if (v == null) return '0.00';
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'string') return Number(v).toFixed(2);
  // Prisma.Decimal
  return Number(v.toString()).toFixed(2);
}
