import type { AuthUserRecord } from '../domain/types.ts';

export interface IAuthRepository {
  findUserById(userId: string): Promise<AuthUserRecord | null>;
  findShopByOwnerId(ownerId: string): Promise<string | null>;
}
