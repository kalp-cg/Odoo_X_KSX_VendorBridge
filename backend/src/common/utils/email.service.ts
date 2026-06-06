import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: Buffer }[];
}

/**
 * EmailService — v1 stub. Logs to console. Real SMTP wiring is a future
 * enhancement and must remain optional and loosely coupled per
 * doc/03-platform/12-NOTIFICATIONS.md.
 *
 * This service is the only place that knows SMTP details exist. If
 * SMTP_ENABLED is false, the email is logged to the application log.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly config: ConfigService) {}

  async send(payload: EmailPayload): Promise<void> {
    const enabled = this.config.get<boolean>('SMTP_ENABLED');
    if (!enabled) {
      this.logger.warn(
        `[email-stub] to=${payload.to} subject="${payload.subject}" attachments=${payload.attachments?.length ?? 0}`,
      );
      return;
    }
    // Future: real SMTP via nodemailer. Today, just log the would-be send.
    this.logger.log(`[email] would send "${payload.subject}" to ${payload.to}`);
  }
}
