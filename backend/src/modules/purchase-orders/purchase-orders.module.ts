import { Module } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfService } from '../../common/utils/pdf.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService, PdfService],
  exports: [PurchaseOrdersService, PdfService],
})
export class PurchaseOrdersModule {}
