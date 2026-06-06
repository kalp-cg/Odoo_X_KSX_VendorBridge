import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import {
  CurrentUser,
  JwtAuthGuard,
  ParseUuidPipe,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { QuotationsService } from './quotations.service';
import { ListQuotationsQuerySchema, SubmitQuotationSchema, UpdateQuotationSchema } from './quotations.dto';
import { UserRole } from '@prisma/client';

const RejectSchema = z.object({ remarks: z.string().min(3).max(2000) });

@ApiTags('Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationsController {
  constructor(private readonly svc: QuotationsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Submit a quotation' })
  async submit(
    @Body(zodPipe(SubmitQuotationSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.submit(dto, user, ctx(req));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List quotations' })
  async list(@Query(zodPipe(ListQuotationsQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get('compare/:rfqId')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Side-by-side comparison of submitted/shortlisted quotations' })
  async compare(@Param('rfqId', ParseUuidPipe) rfqId: string, @CurrentUser() user: AuthPrincipal) {
    return this.svc.compare(rfqId, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get a quotation' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Post(':id/update')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Edit a quotation (only before deadline and in non-terminal state)' })
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(UpdateQuotationSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.update(id, dto, user, ctx(req));
  }

  @Post(':id/shortlist')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Shortlist a quotation (creates/updates an Approval in PENDING)' })
  async shortlist(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.shortlist(id, user, ctx(req));
  }

  @Post(':id/reject')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Reject a quotation (reason required)' })
  async reject(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(RejectSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.reject(id, dto.remarks, user, ctx(req));
  }
}

function ctx(req: Request) {
  return {
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
