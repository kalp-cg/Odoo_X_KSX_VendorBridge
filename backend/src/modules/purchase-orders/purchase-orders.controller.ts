import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  ParseUuidPipe,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ListPosQuerySchema, MarkDeliveredSchema, MarkSentSchema } from './purchase-orders.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly svc: PurchaseOrdersService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List POs (vendors see only their own)' })
  async list(@Query(zodPipe(ListPosQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get PO detail' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Post(':id/sent')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Mark a PO as SENT' })
  async markSent(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(MarkSentSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.markSent(id, dto.note, user, ctx(req));
  }

  @Post(':id/delivered')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Mark a PO as DELIVERED' })
  async markDelivered(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(MarkDeliveredSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.markDelivered(id, dto.note, user, ctx(req));
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Render a PDF of the PO' })
  async pdf(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buf = await this.svc.renderPdf(id, user, ctx(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PO-${id}.pdf"`);
    res.send(buf);
  }
}

function ctx(req: Request) {
  return {
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
