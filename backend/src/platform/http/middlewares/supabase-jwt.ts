import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { UnauthorizedError } from '../../errors/app-error.ts';
import type { ITokenVerifier, TokenPayload } from './auth.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SupabaseJwtConfig {
  jwksUrl: URL;
  issuer: string;
  audience: string;
}

export class SupabaseJwtVerifier implements ITokenVerifier {
  private readonly jwks;

  constructor(private readonly config: SupabaseJwtConfig) {
    this.jwks = createRemoteJWKSet(config.jwksUrl);
  }

  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const verified = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
      });
      const subject = verified.payload.sub;
      if (!isValidUuidSubject(subject)) throw new Error('JWT sub is not a UUID');
      return { userId: subject };
    } catch {
      throw new UnauthorizedError('AUTH_INVALID_TOKEN', 'Invalid or expired access token');
    }
  }
}

function isValidUuidSubject(value: JWTPayload['sub']): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
