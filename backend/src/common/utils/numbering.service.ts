import { PrismaService } from '../../prisma/prisma.service';

type DocPrefix = 'RFQ' | 'Q' | 'PO' | 'INV';

const PREFIX_TO_ID: Record<DocPrefix, string> = {
  RFQ: 'rfq',
  Q: 'quotation',
  PO: 'purchase_order',
  INV: 'invoice',
};

/**
 * Allocates the next document number of the form {PREFIX}-YYYY-NNNN, e.g.
 *   RFQ-2026-0007
 * Sequence is persisted in `sequence_trackers` and is safe across
 * concurrent calls via an atomic conditional update.
 */
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  async next(prefix: DocPrefix, tx?: { sequenceTracker: any }): Promise<string> {
    const id = PREFIX_TO_ID[prefix];
    const year = new Date().getUTCFullYear();
    const client = (tx as any) ?? this.prisma;

    // Atomic UPSERT returning the updated row.
    const row = await client.sequenceTracker.upsert({
      where: { id_year: { id, year } },
      create: { id, year, lastValue: 1 },
      update: { lastValue: { increment: 1 } },
    });
    const padded = String(row.lastValue).padStart(4, '0');
    return `${prefix}-${year}-${padded}`;
  }
}
