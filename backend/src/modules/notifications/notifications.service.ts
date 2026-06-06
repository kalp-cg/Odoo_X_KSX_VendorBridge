import { Injectable, Logger } from '@nestjs/common';
import { NotificationsRepository } from './notifications.repository';
import type { NotificationType, Notification, Prisma } from '@prisma/client';

export interface EmitNotification {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * NotificationService — the ONLY supported way to create notifications.
 *
 * Two output channels:
 *   1. In-app DB row (always, for v1).
 *   2. Pluggable channel interface (no-op console transport in v1; SMTP/email
 *      can be wired in later without changing callers).
 *
 * Critical contract: this method NEVER throws. Failures are logged and
 * isolated so that a downstream channel issue cannot break the parent
 * business operation (per doc/03-platform/12-NOTIFICATIONS.md).
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly repo: NotificationsRepository) {}

  /**
   * Emit a notification. Pass the transaction client `tx` so the row is
   * committed atomically with the parent business change.
   */
  async emit(
    tx: Prisma.TransactionClient | undefined,
    n: EmitNotification,
  ): Promise<Notification | null> {
    try {
      const client: any = tx ?? this.repo['prisma']; // forward to prisma if no tx
      const row = await client.notification.create({
        data: {
          type: n.type,
          userId: n.userId,
          title: n.title,
          message: n.message,
          entityType: n.entityType ?? null,
          entityId: n.entityId ?? null,
          metadata: n.metadata ? (n.metadata as any) : undefined,
        },
      });
      // Fire-and-forget dispatcher for future channels. Must not throw.
      setImmediate(() => this.dispatch(row).catch(() => undefined));
      return row;
    } catch (err) {
      this.logger.error(
        `Notification emit failed: type=${n.type} user=${n.userId} err=${(err as Error).message}`,
      );
      return null;
    }
  }

  /** Emit a batch of notifications in one transaction call. */
  async emitMany(tx: Prisma.TransactionClient, items: EmitNotification[]): Promise<void> {
    for (const item of items) {
      await this.emit(tx, item);
    }
  }

  /** Future-channel dispatcher; in v1 only logs. */
  private async dispatch(n: Notification): Promise<void> {
    this.logger.debug(`[notification] ${n.type} -> user=${n.userId} title="${n.title}"`);
  }

  async listForUser(userId: string, page: number, pageSize: number) {
    return this.repo.listForUser(userId, page, pageSize);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repo.unreadCount(userId);
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    return this.repo.markRead(userId, ids);
  }

  async markAllRead(userId: string): Promise<number> {
    return this.repo.markAllRead(userId);
  }
}
