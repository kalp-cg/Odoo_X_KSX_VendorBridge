import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { ReportsService } from './reports.service';
import { ReportQuerySchema } from './reports.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { UserRole, AuditAction, AuditEntityType } from '@prisma/client';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly svc: ReportsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Dashboard aggregates (counts + recent)' })
  async dashboard(@CurrentUser() user: AuthPrincipal) {
    return this.svc.dashboard(user);
  }

  @Get('spend-by-vendor')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Total spend grouped by vendor' })
  async spendByVendor(
    @Query(zodPipe(ReportQuerySchema)) q: any,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.svc.spendByVendor(q, user);
  }

  @Get('monthly-trend')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Monthly invoice totals (last 12 months)' })
  async monthlyTrend(
    @Query(zodPipe(ReportQuerySchema)) q: any,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.svc.monthlyTrend(q, user);
  }

  @Get('vendor-performance')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Vendor on-time delivery and totals' })
  async vendorPerformance(
    @Query(zodPipe(ReportQuerySchema)) q: any,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.svc.vendorPerformance(q, user);
  }

  @Get('spend-by-vendor.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'CSV export of spend by vendor' })
  async spendCsv(
    @Query(zodPipe(ReportQuerySchema)) q: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.svc.spendByVendorCsv(q, user);
    await this.audit.log(this.prisma, {
      action: AuditAction.REPORT_EXPORTED,
      entityType: AuditEntityType.REPORT,
      description: 'Exported spend-by-vendor CSV',
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId: (req as any).id as string | undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="spend-by-vendor-${Date.now()}.csv"`);
    res.send(csv);
  }

  @Get('monthly-trend.csv')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @ApiOperation({ summary: 'CSV export of monthly trend' })
  async trendCsv(
    @Query(zodPipe(ReportQuerySchema)) q: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const csv = await this.svc.monthlyTrendCsv(q, user);
    await this.audit.log(this.prisma, {
      action: AuditAction.REPORT_EXPORTED,
      entityType: AuditEntityType.REPORT,
      description: 'Exported monthly-trend CSV',
      actorId: user.sub,
      actorEmail: user.email,
      ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId: (req as any).id as string | undefined,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="monthly-trend-${Date.now()}.csv"`);
    res.send(csv);
  }
}
