import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const cols = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'invoices' ORDER BY ordinal_position`) as any[];
console.log('Invoice columns:', cols.map(c => c.column_name).join(', '));
const cols2 = await p.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchase_orders' ORDER BY ordinal_position`) as any[];
console.log('PO columns:', cols2.map(c => c.column_name).join(', '));
await p.$disconnect();
