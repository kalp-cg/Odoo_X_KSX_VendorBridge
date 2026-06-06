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
import { VendorsService } from './vendors.service';
import {
  ChangeVendorStatusSchema,
  CreateVendorWithAddressSchema,
  ListVendorsQuerySchema,
  UpdateVendorSchema,
  type UpdateVendorDto,
} from './vendors.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vendors')
export class VendorsController {
  constructor(private readonly svc: VendorsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'List vendors (admin/officer/manager)' })
  async list(@Query(zodPipe(ListVendorsQuerySchema)) q: any) {
    return this.svc.list(q);
  }

  @Get('me')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Vendor user views their own company' })
  async me(@CurrentUser() user: AuthPrincipal) {
    if (!user.vendorCompanyId) throw new (require('@nestjs/common').NotFoundException)({ code: 'NOT_FOUND', message: 'No vendor profile linked' });
    return this.svc.findById(user.vendorCompanyId);
  }

  @Patch('me')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Vendor user updates limited fields on their own company' })
  async updateMe(
    @CurrentUser() user: AuthPrincipal,
    @Body(zodPipe(UpdateVendorSchema)) dto: any,
    @Req() req: Request,
  ) {
    if (!user.vendorCompanyId) throw new (require('@nestjs/common').NotFoundException)({ code: 'NOT_FOUND', message: 'No vendor profile linked' });
    // Restrict vendor self-edits to safe fields
    const safe: UpdateVendorDto = {
      contactPhone: dto.contactPhone,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      postalCode: dto.postalCode,
      country: dto.country,
    };
    return this.svc.update(user.vendorCompanyId, safe, ctx(user, req));
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get a vendor by id' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a vendor (admin)' })
  async create(
    @Body(zodPipe(CreateVendorWithAddressSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.create(dto, ctx(user, req));
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update vendor (admin)' })
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(UpdateVendorSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.update(id, dto, ctx(user, req));
  }

  @Post(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change vendor status (PENDING/ACTIVE/INACTIVE/BLOCKED)' })
  async changeStatus(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(ChangeVendorStatusSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.changeStatus(id, dto, ctx(user, req));
  }
}

function ctx(user: AuthPrincipal, req: Request) {
  return {
    id: user.sub,
    email: user.email,
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
