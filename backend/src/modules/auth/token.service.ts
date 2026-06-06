import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { AuthPrincipal } from '../../common';

export interface AccessTokenPayload extends AuthPrincipal {}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async signAccessToken(principal: AuthPrincipal): Promise<string> {
    return this.jwt.signAsync(principal, {
      privateKey: this.config.get<string>('JWT_PRIVATE_KEY')!,
      algorithm: 'RS256',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL'),
      issuer: this.config.get<string>('JWT_ISSUER'),
      audience: this.config.get<string>('JWT_AUDIENCE'),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      publicKey: this.config.get<string>('JWT_PUBLIC_KEY')!,
      algorithms: ['RS256'],
      issuer: this.config.get<string>('JWT_ISSUER'),
      audience: this.config.get<string>('JWT_AUDIENCE'),
    });
  }

  accessTtlSeconds(): number {
    return this.parseTtl(this.config.get<string>('JWT_ACCESS_TTL')!);
  }

  refreshTtlSeconds(): number {
    return this.parseTtl(this.config.get<string>('JWT_REFRESH_TTL')!);
  }

  private parseTtl(s: string): number {
    const m = /^(\d+)([smhd])$/.exec(s);
    if (!m) return 900;
    const n = Number(m[1]);
    switch (m[2]) {
      case 's': return n;
      case 'm': return n * 60;
      case 'h': return n * 3600;
      case 'd': return n * 86400;
      default: return n;
    }
  }
}
