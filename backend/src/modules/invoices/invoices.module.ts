import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PdfService } from '../../common/utils/pdf.service';
import { EmailService } from '../../common/utils/email.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfService, EmailService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
