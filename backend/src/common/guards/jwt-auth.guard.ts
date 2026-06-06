import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthPrincipal } from '../decorators/current-user.decorator';
import { unauthenticated } from '../exceptions/api.exception';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw unauthenticated('Missing bearer token');

    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(token, {
        publicKey: this.config.get<string>('JWT_PUBLIC_KEY')!,
        algorithms: ['RS256'],
        issuer: this.config.get<string>('JWT_ISSUER'),
        audience: this.config.get<string>('JWT_AUDIENCE'),
      });
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired access token',
      });
    }
  }

  private extractToken(req: any): string | null {
    const auth = req.headers['authorization'] as string | undefined;
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      return auth.substring(7).trim();
    }
    return null;
  }
}
