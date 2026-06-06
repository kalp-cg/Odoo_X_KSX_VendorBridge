import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthPrincipal } from '../decorators/current-user.decorator';
import type { UserRole } from '@prisma/client';

/**
 * RolesGuard — runs AFTER JwtAuthGuard so `req.user` is set.
 * If the route is marked @Public() the guard is bypassed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @Roles() declared

    const user = ctx.switchToHttp().getRequest().user as AuthPrincipal | undefined;
    if (!user) return false;
    return required.includes(user.role);
  }
}
