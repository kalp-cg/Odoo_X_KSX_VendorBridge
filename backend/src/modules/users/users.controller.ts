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
import {
  ChangeRoleSchema,
  ChangeStatusSchema,
  CreateUserSchema,
  ListUsersQuerySchema,
  UpdateUserSchema,
} from './users.dto';
import { UsersService } from './users.service';
import { UserRole } from '@prisma/client';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List users (ADMIN)' })
  async list(@Query(zodPipe(ListUsersQuerySchema)) q: any) {
    return this.svc.list(q);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER)
  @ApiOperation({ summary: 'Get a user by id' })
  async getOne(@Param('id', ParseUuidPipe) id: string) {
    return this.svc.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a user (fullName, phone)' })
  async update(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(UpdateUserSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.update(id, dto, ctx(user, req));
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a user (ADMIN)' })
  async create(
    @Body(zodPipe(CreateUserSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.create(dto, ctx(user, req));
  }

  @Post(':id/role')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Change a user role' })
  async changeRole(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(ChangeRoleSchema)) dto: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.changeRole(id, dto, ctx(user, req));
  }

  @Post(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activate, suspend, or deactivate a user' })
  async changeStatus(
    @Param('id', ParseUuidPipe) id: string,
    @Body(zodPipe(ChangeStatusSchema)) dto: any,
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
