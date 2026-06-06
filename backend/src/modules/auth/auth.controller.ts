import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  Public,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import {
  ChangePasswordSchema,
  ForgotPasswordSchema,
  LoginSchema,
  ResetPasswordSchema,
  SignupSchema,
} from './auth.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Self-signup. Vendors create their own account + company.' })
  async signup(
    @Body(zodPipe(SignupSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = this.reqContext(req);
    const user = await this.auth.signup(dto, ctx);
    // Auto-login after signup
    const result = await this.auth.login(
      { email: dto.email, password: dto.password },
      ctx,
    );
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Email + password login' })
  async login(
    @Body(zodPipe(LoginSchema)) dto: any,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.reqContext(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Rotate refresh token; issues new access + refresh' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = this.readRefreshToken(req);
    const result = await this.auth.refresh(raw, this.reqContext(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current refresh token' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = this.readRefreshToken(req);
    const user = (req as any).user as AuthPrincipal;
    await this.auth.logout(raw, user.sub, this.reqContext(req));
    res.clearCookie(AuthService.REFRESH_COOKIE, this.cookieOptions(0));
    return { ok: true };
  }

  @Public()
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Request a password-reset email/token' })
  async forgot(
    @Body(zodPipe(ForgotPasswordSchema)) dto: any,
    @Req() req: Request,
  ) {
    return this.auth.forgotPassword(dto.email, this.reqContext(req));
  }

  @Public()
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Complete password reset with token' })
  async reset(
    @Body(zodPipe(ResetPasswordSchema)) dto: any,
    @Req() req: Request,
  ) {
    await this.auth.resetPassword(dto.token, dto.newPassword, this.reqContext(req));
    return { ok: true };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password while authenticated' })
  async change(
    @CurrentUser() user: AuthPrincipal,
    @Body(zodPipe(ChangePasswordSchema)) dto: any,
    @Req() req: Request,
  ) {
    await this.auth.changePassword(user.sub, dto, this.reqContext(req));
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated user (with vendorCompany if VENDOR)' })
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  async me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user.sub);
  }

  // ---- helpers ----
  private setRefreshCookie(res: Response, raw: string) {
    res.cookie(AuthService.REFRESH_COOKIE, raw, this.auth.cookieOptions(this.tokens.refreshTtlSeconds()));
  }

  private readRefreshToken(req: Request): string {
    const fromCookie = (req as any).cookies?.[AuthService.REFRESH_COOKIE] as string | undefined;
    if (fromCookie) return fromCookie;
    const auth = req.headers['authorization'] as string | undefined;
    if (auth && auth.toLowerCase().startsWith('refresh ')) return auth.substring(8).trim();
    return '';
  }

  private cookieOptions(maxAgeSec: number) {
    return { ...this.auth.cookieOptions(maxAgeSec) };
  }

  private reqContext(req: Request) {
    return {
      ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
      userAgent: req.headers['user-agent'] as string | undefined,
      requestId: (req as any).id as string | undefined,
    };
  }
}
