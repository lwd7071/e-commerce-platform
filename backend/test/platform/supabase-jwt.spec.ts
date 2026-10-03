import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseJwtVerifier } from '../../src/platform/http/middlewares/supabase-jwt.ts';

describe('SupabaseJwtVerifier', () => {
  it('keeps JWKS and issuer configuration server-side', () => {
    const verifier = new SupabaseJwtVerifier({
      jwksUrl: new URL('https://localtest.supabase.co/auth/v1/.well-known/jwks.json'),
      issuer: 'https://localtest.supabase.co/auth/v1',
      audience: 'authenticated',
    });
    assert.ok(verifier instanceof SupabaseJwtVerifier);
  });

  it('rejects malformed tokens with the stable auth error', async () => {
    const verifier = new SupabaseJwtVerifier({
      jwksUrl: new URL('https://localtest.supabase.co/auth/v1/.well-known/jwks.json'),
      issuer: 'https://localtest.supabase.co/auth/v1',
      audience: 'authenticated',
    });
    await assert.rejects(verifier.verifyToken('not-a-jwt'), (error: unknown) =>
      error instanceof Error
      && 'code' in error && error.code === 'AUTH_INVALID_TOKEN'
      && 'httpStatus' in error && error.httpStatus === 401);
  });
});
