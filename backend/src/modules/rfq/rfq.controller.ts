import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  ParseUuidPipe,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { RfqService } from './rfq.service';
import { CancelRfqSchema, CreateRfqSchema, ListRfqQuerySchema, UpdateRfqSchema } from './rfq.dto';
import { UserRole } from '@prisma/client';

@ApiTags('RFQ')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('rfqs')
export class RfqController {
  constructor(private readonly svc: RfqService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Create a DRAFT RFQ' })
  async create(
    @Body(zodPipe(CreateRfqSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.create(dto, user, ctx(req));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List RFQs (vendors see only invited)' })
  async list(@Query(zodPipe(ListRfqQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get an RFQ by id' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Edit DRAFT RFQ (creator only)' })
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(UpdateRfqSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.update(id, dto, user, ctx(req));
  }

  @Post(':id/publish')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Publish a DRAFT RFQ' })
  async publish(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.publish(id, user, ctx(req));
  }

  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Close an RFQ (no more quotations accepted)' })
  async close(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.close(id, user, ctx(req));
  }

  @Post(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Cancel an RFQ (with reason)' })
  async cancel(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(CancelRfqSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.cancel(id, dto.reason, user, ctx(req));
  }
}

function ctx(req: Request) {
  return {
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
