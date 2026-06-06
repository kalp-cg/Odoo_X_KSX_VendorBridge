import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import {
  businessRule,
  conflict,
  notFound,
  forbidden,
  normalizePage,
  buildPage,
  type Page,
  type PageRequest,
} from '../../common';
import { hash as argonHash } from 'argon2';
import { AuditAction, AuditEntityType, UserRole, UserStatus } from '@prisma/client';
import type { CreateUserDto, UpdateUserDto, ChangeRoleDto, ChangeStatusDto, ListUsersQueryDto } from './users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async create(
    dto: CreateUserDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw conflict('A user with this email already exists');

    if (dto.role === UserRole.VENDOR && !dto.vendorCompanyId) {
      throw businessRule('vendorCompanyId is required for VENDOR role');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role,
        status: dto.status,
        vendorCompanyId: dto.vendorCompanyId ?? null,
        passwordHash: await argonHash(dto.password),
        createdById: actor.id,
      },
    });

    await this.audit.log(this.prisma, {
      action: AuditAction.USER_INVITED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `User invited: ${user.email} (${user.role})`,
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });

    return user;
  }

  async list(q: ListUsersQueryDto): Promise<Page<unknown>> {
    const { page, pageSize, skip, take } = normalizePage(q);
    const where: any = {};
    if (q.role) where.role = q.role;
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { email: { contains: q.search, mode: 'insensitive' } },
        { fullName: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { vendorCompany: { select: { id: true, displayName: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);
    return buildPage(rows, total, page, pageSize);
  }

  async findById(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { vendorCompany: true },
    });
    if (!u) throw notFound('User not found');
    return u;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const user = await this.findById(id);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        fullName: dto.fullName ?? user.fullName,
        phone: dto.phone ?? user.phone,
      },
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.USER_ACTIVATED, // generic profile update
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `Profile updated: ${user.email}`,
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });
    return updated;
  }

  async changeRole(
    id: string,
    dto: ChangeRoleDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const user = await this.findById(id);

    // Last-admin protection
    if (user.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const remaining = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, NOT: { id: user.id } },
      });
      if (remaining === 0) throw businessRule('Cannot demote the last active admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { role: dto.role },
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `Role changed: ${user.email} (${user.role} -> ${dto.role})`,
      metadata: { from: user.role, to: dto.role },
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });
    return updated;
  }

  async changeStatus(
    id: string,
    dto: ChangeStatusDto,
    actor: { id: string; email: string; ipAddress?: string; userAgent?: string; requestId?: string },
  ) {
    const user = await this.findById(id);

    // Last-admin protection
    if (user.role === UserRole.ADMIN && dto.status !== UserStatus.ACTIVE) {
      const remaining = await this.prisma.user.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, NOT: { id: user.id } },
      });
      if (remaining === 0) throw businessRule('Cannot deactivate the last active admin');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { status: dto.status },
    });
    // If suspended/deactivated, revoke refresh tokens
    if (dto.status !== UserStatus.ACTIVE) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    const action =
      dto.status === UserStatus.ACTIVE
        ? AuditAction.USER_ACTIVATED
        : dto.status === UserStatus.SUSPENDED
        ? AuditAction.USER_SUSPENDED
        : AuditAction.USER_DEACTIVATED;
    await this.audit.log(this.prisma, {
      action,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `Status changed: ${user.email} -> ${dto.status}`,
      metadata: { from: user.status, to: dto.status, reason: dto.reason ?? null },
      actorId: actor.id,
      actorEmail: actor.email,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId,
    });
    return updated;
  }
}
