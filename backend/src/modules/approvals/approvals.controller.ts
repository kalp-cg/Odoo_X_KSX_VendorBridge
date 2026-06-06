import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { ApprovalsService } from './approvals.service';
import { ListApprovalsQuerySchema, RejectApprovalSchema } from './approvals.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'List approvals (role-scoped)' })
  async list(@Query(zodPipe(ListApprovalsQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get an approval by id' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Post(':id/approve')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a PENDING approval (auto-creates PO + Invoice)' })
  async approve(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.approve(id, user, ctx(req));
  }

  @Post(':id/reject')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject a PENDING approval (remarks required)' })
  async reject(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(RejectApprovalSchema)) dto: any,
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
