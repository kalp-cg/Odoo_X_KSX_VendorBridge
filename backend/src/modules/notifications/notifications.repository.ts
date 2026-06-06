import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePage, buildPage, type Page } from '../../common';

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, page: number, pageSize: number): Promise<Page<unknown>> {
    const { skip, take } = normalizePage({ page, pageSize });
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, status: 'UNREAD' } });
  }

  async markRead(userId: string, ids: string[]): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, id: { in: ids }, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
    return res.count;
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, status: 'UNREAD' },
      data: { status: 'READ', readAt: new Date() },
    });
    return res.count;
  }
}
