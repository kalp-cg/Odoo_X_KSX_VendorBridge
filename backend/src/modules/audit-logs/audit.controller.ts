import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard, Roles, RolesGuard, normalizePage, buildPage, type AuthPrincipal, CurrentUser } from '../../common';
import { AuditService, type AuditQuery } from './audit.service';
import { z } from 'zod';
import { zodPipe } from '../../common';
import { AuditAction, AuditEntityType, UserRole } from '@prisma/client';

const QuerySchema = z.object({
  entityType: z.nativeEnum(AuditEntityType).optional(),
  entityId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  actorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Query audit logs (paginated, role-scoped)' })
  async list(@CurrentUser() _user: AuthPrincipal, @Query(zodPipe(QuerySchema)) q: z.infer<typeof QuerySchema>) {
    const { page, pageSize, skip, take } = normalizePage(q);
    const filters: AuditQuery = { ...q, page, pageSize };
    const { rows, total } = await this.audit.query(filters);
    return buildPage(rows, total, page, pageSize);
  }

  @Get('export.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  async export(@Query(zodPipe(QuerySchema)) q: z.infer<typeof QuerySchema>, @Res() res: Response) {
    const csv = await this.audit.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res.send(csv);
  }
}
