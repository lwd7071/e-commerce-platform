import type { IUserProfileRepository } from '../domain/repositories';
import type { UserProfile, UUID } from '../domain/types';
import { ResourceNotFoundError } from '../domain/errors';
import { validateUpdateProfileDTO, type UpdateProfileDTO } from '../contracts/buyer.dto';

/**
 * Service quản lý thông tin hồ sơ người mua (Profile).
 * Áp dụng:
 * - Dependency Inversion (D): Nhận IUserProfileRepository interface.
 * - ResourceNotFoundError (404) khi không tìm thấy hồ sơ (auth-rbac-rls.md §3).
 */
export class ProfileService {
  constructor(private readonly profileRepo: IUserProfileRepository) {}

  async getProfile(userId: UUID): Promise<UserProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new ResourceNotFoundError('User profile not found', { userId });
    }
    return profile;
  }

  async updateProfile(userId: UUID, rawInput: unknown): Promise<UserProfile> {
    const validated: UpdateProfileDTO = validateUpdateProfileDTO(rawInput);
    const existing = await this.profileRepo.findByUserId(userId);
    const now = new Date().toISOString();

    const profileToSave: UserProfile = {
      userId,
      fullName: validated.fullName !== undefined ? validated.fullName : (existing?.fullName ?? null),
      phone: validated.phone !== undefined ? validated.phone : (existing?.phone ?? null),
      avatarUrl: validated.avatarUrl !== undefined ? validated.avatarUrl : (existing?.avatarUrl ?? null),
      updatedAt: now,
    };

    return this.profileRepo.upsert(profileToSave);
  }
}
