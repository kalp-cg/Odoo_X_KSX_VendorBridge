import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
  normalizePage,
  ParseUuidPipe,
} from '../../common';
import { NotificationsService } from './notifications.service';
import { UserRole } from '@prisma/client';

const ListSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

const MarkReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
});

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List my notifications (paginated)' })
  async list(
    @CurrentUser() user: AuthPrincipal,
    @Query(zodPipe(ListSchema)) q: z.infer<typeof ListSchema>,
  ) {
    const { page, pageSize } = normalizePage(q);
    return this.svc.listForUser(user.sub, page, pageSize);
  }

  @Get('unread-count')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Count my unread notifications' })
  async unread(@CurrentUser() user: AuthPrincipal) {
    return { count: await this.svc.unreadCount(user.sub) };
  }

  @Post('mark-read')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Mark one or more notifications as read' })
  async markRead(@CurrentUser() user: AuthPrincipal, @Body(zodPipe(MarkReadSchema)) body: z.infer<typeof MarkReadSchema>) {
    return { updated: await this.svc.markRead(user.sub, body.ids) };
  }

  @Post('mark-all-read')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Mark ALL of my notifications as read' })
  async markAll(@CurrentUser() user: AuthPrincipal) {
    return { updated: await this.svc.markAllRead(user.sub) };
  }
}
