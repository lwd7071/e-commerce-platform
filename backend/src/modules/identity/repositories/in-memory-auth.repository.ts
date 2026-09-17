import type { IAuthRepository } from './auth.repository.ts';
import type { AuthUserRecord } from '../domain/types.ts';

export class InMemoryAuthRepository implements IAuthRepository {
  private users = new Map<string, AuthUserRecord>();
  private shopOwners = new Map<string, string>(); // ownerId -> shopId

  public seedUsers(users: AuthUserRecord[]): void {
    for (const u of users) {
      this.users.set(u.id, { ...u });
    }
  }

  public seedShop(ownerId: string, shopId: string): void {
    this.shopOwners.set(ownerId, shopId);
  }

  public async findUserById(userId: string): Promise<AuthUserRecord | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    return { ...user };
  }

  public async findShopByOwnerId(ownerId: string): Promise<string | null> {
    return this.shopOwners.get(ownerId) || null;
  }
}
