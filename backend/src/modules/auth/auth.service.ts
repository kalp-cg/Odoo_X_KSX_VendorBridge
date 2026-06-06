import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit-logs/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TokenService } from './token.service';
import {
  AuthPrincipal,
  businessRule,
  conflict,
  forbidden,
  notFound,
  randomToken,
  sha256,
  unauthenticated,
} from '../../common';
import { AuditAction, AuditEntityType, NotificationType, UserRole, UserStatus, VendorStatus } from '@prisma/client';
import { SignupDto, LoginDto, ChangePasswordDto } from './auth.dto';
import { hash as argonHash, verify as argonVerify } from 'argon2';

const REFRESH_COOKIE = 'vb_refresh';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  // ============================================================
  // SIGNUP
  // ============================================================
  async signup(
    dto: SignupDto,
    requestContext: { ipAddress?: string; userAgent?: string; requestId?: string },
    actorIdOverride?: string,
  ) {
    const role: UserRole = dto.role ?? UserRole.VENDOR;
    if (role === UserRole.ADMIN) {
      // Only existing admins may create admin accounts.
      if (!actorIdOverride) throw forbidden('Only existing admins may create admin accounts');
      const actor = await this.prisma.user.findUnique({ where: { id: actorIdOverride } });
      if (!actor || actor.role !== UserRole.ADMIN) throw forbidden('Only admins may create admin accounts');
    }

    // Vendor self-signup creates a PENDING_VERIFICATION company.
    let vendorCompanyId: string | undefined;
    if (role === UserRole.VENDOR) {
      if (!dto.vendorCompany) throw businessRule('vendorCompany is required for VENDOR signup');

      const existing = await this.prisma.vendorCompany.findFirst({
        where: { OR: [{ gstNumber: dto.vendorCompany.gstNumber ?? '__none__' }, { contactEmail: dto.email }] },
      });
      if (existing) throw conflict('A vendor with the same GST or contact email already exists');

      const company = await this.prisma.vendorCompany.create({
        data: {
          legalName: dto.vendorCompany.legalName,
          displayName: dto.vendorCompany.displayName,
          gstNumber: dto.vendorCompany.gstNumber,
          panNumber: dto.vendorCompany.panNumber,
          contactEmail: dto.email,
          contactPhone: dto.vendorCompany.contactPhone,
          addressLine1: dto.vendorCompany.addressLine1,
          addressLine2: dto.vendorCompany.addressLine2,
          city: dto.vendorCompany.city,
          state: dto.vendorCompany.state,
          postalCode: dto.vendorCompany.postalCode,
          country: dto.vendorCompany.country,
          category: dto.vendorCompany.category,
          status: VendorStatus.PENDING_VERIFICATION,
        },
      });
      vendorCompanyId = company.id;
    }

    const passwordHash = await argonHash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        role,
        status: role === UserRole.VENDOR ? UserStatus.INACTIVE : UserStatus.ACTIVE,
        vendorCompanyId: vendorCompanyId ?? null,
        createdById: actorIdOverride ?? null,
      },
    });

    await this.audit.log(this.prisma, {
      action: AuditAction.USER_SIGNUP,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `New user signed up: ${user.email} (${role})`,
      actorId: actorIdOverride ?? null,
      actorEmail: dto.email,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });

    return user;
  }

  // ============================================================
  // LOGIN
  // ============================================================
  async login(
    dto: LoginDto,
    requestContext: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) {
      await this.audit.log(this.prisma, {
        action: AuditAction.USER_LOGIN_FAILED,
        entityType: AuditEntityType.AUTH,
        description: `Login failed (unknown email): ${dto.email}`,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        requestId: requestContext.requestId,
      });
      throw unauthenticated('Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log(this.prisma, {
        action: AuditAction.USER_LOCKED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        description: `Login attempt on locked account: ${user.email}`,
        actorId: user.id,
        actorEmail: user.email,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        requestId: requestContext.requestId,
      });
      throw forbidden('Account is temporarily locked. Try again later.');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw forbidden(`Account is ${user.status.toLowerCase()}. Please contact your administrator.`);
    }

    const ok = await argonVerify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) {
      const max = this.config.get<number>('AUTH_MAX_FAILED_ATTEMPTS')!;
      const windowMin = this.config.get<number>('AUTH_LOCKOUT_WINDOW_MINUTES')!;
      const lockMin = this.config.get<number>('AUTH_LOCKOUT_DURATION_MINUTES')!;

      const newAttempts = user.failedAttempts + 1;
      const shouldLock = newAttempts >= max;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: shouldLock ? 0 : newAttempts,
          lockedUntil: shouldLock ? new Date(Date.now() + lockMin * 60_000) : user.lockedUntil,
        },
      });

      await this.audit.log(this.prisma, {
        action: shouldLock ? AuditAction.USER_LOCKED : AuditAction.USER_LOGIN_FAILED,
        entityType: AuditEntityType.AUTH,
        entityId: user.id,
        description: shouldLock
          ? `Account locked after ${newAttempts} failed attempts: ${user.email}`
          : `Bad password (attempt ${newAttempts}): ${user.email}`,
        actorId: user.id,
        actorEmail: user.email,
        ipAddress: requestContext.ipAddress,
        userAgent: requestContext.userAgent,
        requestId: requestContext.requestId,
      });
      throw unauthenticated('Invalid email or password');
    }

    // Reset counter on success
    if (user.failedAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }

    // Issue tokens
    const principal: AuthPrincipal = {
      sub: user.id,
      email: user.email,
      role: user.role,
      vendorCompanyId: user.vendorCompanyId ?? null,
    };
    const accessToken = await this.tokens.signAccessToken(principal);
    const refreshToken = await this.issueRefreshToken(user.id, requestContext);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.audit.log(this.prisma, {
      action: AuditAction.USER_LOGIN,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      description: `Login success: ${user.email}`,
      actorId: user.id,
      actorEmail: user.email,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });

    return {
      accessToken,
      refreshToken,
      user: this.toPublicUser(user),
    };
  }

  // ============================================================
  // REFRESH (single-use rotation)
  // ============================================================
  async refresh(
    rawToken: string,
    requestContext: { ipAddress?: string; userAgent?: string; requestId?: string },
  ): Promise<{ accessToken: string; refreshToken: string; user: PublicUser }> {
    const tokenHash = sha256(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
      // Reuse detection — revoke entire chain
      if (existing) await this.revokeChain(existing.id, 'reuse detected');
      throw unauthenticated('Invalid or expired refresh token');
    }
    if (existing.replacedById) {
      await this.revokeChain(existing.id, 'replay detected');
      throw unauthenticated('Refresh token replay detected');
    }

    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) throw unauthenticated('User no longer exists');
    const principal: AuthPrincipal = {
      sub: user.id,
      email: user.email,
      role: user.role,
      vendorCompanyId: user.vendorCompanyId ?? null,
    };
    const accessToken = await this.tokens.signAccessToken(principal);
    const newRaw = randomToken(48);
    const newHash = sha256(newRaw);

    const newRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        userAgent: requestContext.userAgent,
        ipAddress: requestContext.ipAddress,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlSeconds() * 1000),
      },
    });
    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), replacedById: newRow.id },
    });

    return { accessToken, refreshToken: newRaw, user: this.toPublicUser(user) };
  }

  async logout(rawToken: string | undefined, userId: string, requestContext: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<void> {
    if (rawToken) {
      const tokenHash = sha256(rawToken);
      await this.prisma.refreshToken
        .update({
          where: { tokenHash },
          data: { revokedAt: new Date() },
        })
        .catch(() => undefined);
    }
    await this.audit.log(this.prisma, {
      action: AuditAction.USER_LOGOUT,
      entityType: AuditEntityType.AUTH,
      entityId: userId,
      description: 'User logged out',
      actorId: userId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });
  }

  // ============================================================
  // PASSWORD
  // ============================================================
  async changePassword(userId: string, dto: ChangePasswordDto, requestContext: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('User not found');
    const ok = await argonVerify(user.passwordHash, dto.currentPassword).catch(() => false);
    if (!ok) throw unauthenticated('Current password is incorrect');
    const newHash = await argonHash(dto.newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
    // Revoke all refresh tokens to force re-auth elsewhere
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      entityType: AuditEntityType.USER,
      entityId: userId,
      description: 'Password changed by user',
      actorId: userId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });
  }

  async forgotPassword(email: string, requestContext: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<{ resetToken?: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't leak existence — return ok.
      return {};
    }
    const ttlMin = this.config.get<number>('AUTH_PASSWORD_RESET_TTL_MINUTES')!;
    const raw = randomToken(48);
    const tokenHash = sha256(raw);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + ttlMin * 60_000),
      },
    });
    await this.audit.log(this.prisma, {
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      description: `Password reset requested for ${user.email}`,
      actorId: user.id,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });
    // v1: log to console; v1.1: send via SMTP
    this.logger.warn(`[password-reset] ${user.email} -> token=${raw}`);
    if (this.config.get<boolean>('SMTP_ENABLED')) {
      // Hook for future email transport
      this.logger.log(`[email-stub] would send reset link to ${user.email}`);
    }
    // In dev we surface the token so it's usable for testing.
    if (this.config.get<string>('NODE_ENV') === 'development') {
      return { resetToken: raw };
    }
    return {};
  }

  async resetPassword(rawToken: string, newPassword: string, requestContext: { ipAddress?: string; userAgent?: string; requestId?: string }): Promise<void> {
    const tokenHash = sha256(rawToken);
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw unauthenticated('Invalid or expired reset token');
    }
    const newHash = await argonHash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: newHash } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    await this.audit.log(this.prisma, {
      action: AuditAction.PASSWORD_RESET_COMPLETED,
      entityType: AuditEntityType.USER,
      entityId: row.userId,
      description: 'Password reset completed via token',
      actorId: row.userId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
    });
  }

  // ============================================================
  // ME
  // ============================================================
  async me(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { vendorCompany: true },
    });
    if (!u) throw notFound('User not found');
    return { ...this.toPublicUser(u), vendorCompany: u.vendorCompany };
  }

  // ============================================================
  // Helpers
  // ============================================================
  private async issueRefreshToken(userId: string, ctx: { ipAddress?: string; userAgent?: string }): Promise<string> {
    const raw = randomToken(48);
    const tokenHash = sha256(raw);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        userAgent: ctx.userAgent,
        ipAddress: ctx.ipAddress,
        expiresAt: new Date(Date.now() + this.tokens.refreshTtlSeconds() * 1000),
      },
    });
    return raw;
  }

  private async revokeChain(startId: string, reason: string): Promise<void> {
    this.logger.warn(`Revoking refresh-token chain from ${startId}: ${reason}`);
    await this.prisma.refreshToken.update({
      where: { id: startId },
      data: { revokedAt: new Date() },
    });
    // Walk the chain forward and revoke any descendants too.
    let cursor: string | null = startId;
    let guard = 0;
    while (cursor && guard < 1000) {
      const next: { id: string } | null = await this.prisma.refreshToken.findFirst({
        where: { replacedById: null, revokedAt: null, NOT: { id: cursor } },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!next) break;
      await this.prisma.refreshToken.update({ where: { id: next.id }, data: { revokedAt: new Date() } });
      cursor = next.id;
      guard++;
    }
  }

  cookieOptions(maxAgeSec: number) {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE')!,
      sameSite: this.config.get<string>('COOKIE_SAME_SITE')! as 'lax' | 'strict' | 'none',
      domain: this.config.get<string>('COOKIE_DOMAIN')!,
      path: '/',
      maxAge: maxAgeSec * 1000,
    };
  }

  static get REFRESH_COOKIE() {
    return REFRESH_COOKIE;
  }

  private toPublicUser(u: { id: string; email: string; fullName: string; role: UserRole; status: UserStatus; phone: string | null; vendorCompanyId: string | null; lastLoginAt: Date | null }) {
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      phone: u.phone,
      vendorCompanyId: u.vendorCompanyId,
      lastLoginAt: u.lastLoginAt,
    };
  }
}

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone: string | null;
  vendorCompanyId: string | null;
  lastLoginAt: Date | null;
};
