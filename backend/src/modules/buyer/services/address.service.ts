import { randomUUID } from 'node:crypto';
import type { IAddressRepository } from '../domain/repositories';
import type { Address, UUID } from '../domain/types';
import { ResourceNotFoundError, ValidationError } from '../domain/errors';
import {
  validateCreateAddressDTO,
  validateUpdateAddressDTO,
  type CreateAddressDTO,
  type UpdateAddressDTO,
} from '../contracts/buyer.dto';

/**
 * Service quản lý địa chỉ nhận hàng của người mua (Address).
 * Áp dụng:
 * - [RB-LB05]: Tối đa 10 địa chỉ/User, tối đa 1 địa chỉ isDefault = TRUE.
 * - [auth-rbac-rls.md §3]: Trả về 404 RESOURCE_NOT_FOUND khi truy cập địa chỉ không thuộc về caller.
 * - Heuristic UX: Tự động gán isDefault = true cho địa chỉ đầu tiên được tạo nếu user chưa có địa chỉ nào.
 */
export class AddressService {
  constructor(private readonly addressRepo: IAddressRepository) {}

  async getAddresses(userId: UUID): Promise<Address[]> {
    return this.addressRepo.findByUserId(userId);
  }

  async getAddressById(userId: UUID, addressId: UUID): Promise<Address> {
    const address = await this.addressRepo.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new ResourceNotFoundError('Address not found', { addressId });
    }
    return address;
  }

  async createAddress(userId: UUID, rawInput: unknown): Promise<Address> {
    const validated: CreateAddressDTO = validateCreateAddressDTO(rawInput);
    const existingAddresses = await this.addressRepo.findByUserId(userId);

    // [RB-LB05] Tối đa 10 địa chỉ/User
    if (existingAddresses.length >= 10) {
      throw new ValidationError('Mỗi người dùng có tối đa 10 địa chỉ nhận hàng (RB-LB05).', {
        maxAddresses: 10,
        currentCount: existingAddresses.length,
      });
    }

    const isFirstAddress = existingAddresses.length === 0;
    const shouldBeDefault = isFirstAddress || (validated.isDefault === true);
    const now = new Date().toISOString();

    const newAddress: Address = {
      addressId: randomUUID(),
      userId,
      recipientName: validated.recipientName,
      phone: validated.phone,
      province: validated.province,
      district: validated.district,
      ward: validated.ward,
      detailAddress: validated.detailAddress,
      isDefault: shouldBeDefault,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.addressRepo.create(newAddress);

    // Nếu đặt là default và đã có các địa chỉ khác, đồng bộ chuyển các địa chỉ cũ về isDefault=false
    if (shouldBeDefault && !isFirstAddress) {
      await this.addressRepo.setDefault(userId, created.addressId);
    }

    return created;
  }

  async updateAddress(userId: UUID, addressId: UUID, rawInput: unknown): Promise<Address> {
    const validated: UpdateAddressDTO = validateUpdateAddressDTO(rawInput);
    const address = await this.addressRepo.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new ResourceNotFoundError('Address not found', { addressId });
    }

    const now = new Date().toISOString();
    const updatedAddress: Address = {
      ...address,
      recipientName: validated.recipientName ?? address.recipientName,
      phone: validated.phone ?? address.phone,
      province: validated.province ?? address.province,
      district: validated.district ?? address.district,
      ward: validated.ward ?? address.ward,
      detailAddress: validated.detailAddress ?? address.detailAddress,
      isDefault: validated.isDefault !== undefined ? validated.isDefault : address.isDefault,
      updatedAt: now,
    };

    const saved = await this.addressRepo.update(updatedAddress);

    if (validated.isDefault === true && !address.isDefault) {
      await this.addressRepo.setDefault(userId, addressId);
      saved.isDefault = true;
    }

    return saved;
  }

  async deleteAddress(userId: UUID, addressId: UUID): Promise<void> {
    const address = await this.addressRepo.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new ResourceNotFoundError('Address not found', { addressId });
    }
    await this.addressRepo.delete(addressId);
  }

  async setDefault(userId: UUID, addressId: UUID): Promise<void> {
    const address = await this.addressRepo.findById(addressId);
    if (!address || address.userId !== userId) {
      throw new ResourceNotFoundError('Address not found', { addressId });
    }
    await this.addressRepo.setDefault(userId, addressId);
  }
}
