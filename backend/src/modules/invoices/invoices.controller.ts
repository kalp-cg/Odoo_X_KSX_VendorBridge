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
import { InvoicesService } from './invoices.service';
import { ListInvoicesQuerySchema, MarkPaidSchema } from './invoices.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List invoices' })
  async list(@Query(zodPipe(ListInvoicesQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get invoice detail' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Post(':id/pay')
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @ApiOperation({ summary: 'Mark an invoice as PAID (records a payment)' })
  async pay(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(MarkPaidSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.markPaid(id, dto, user, ctx(req));
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Render a PDF of the invoice' })
  async pdf(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const buf = await this.svc.renderPdf(id, user, ctx(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="INV-${id}.pdf"`);
    res.send(buf);
  }

  @Post(':id/email')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Email the invoice to the vendor' })
  async email(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.emailInvoice(id, user, ctx(req));
  }
}

function ctx(req: Request) {
  return {
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
