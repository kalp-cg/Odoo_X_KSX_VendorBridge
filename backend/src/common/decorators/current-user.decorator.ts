import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@prisma/client';

export interface AuthPrincipal {
  sub: string; // userId
  email: string;
  role: UserRole;
  vendorCompanyId: string | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as AuthPrincipal;
  },
);
