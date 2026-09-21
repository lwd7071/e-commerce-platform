import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ProfileService } from '../../../../src/modules/buyer/services/profile.service';
import { AddressService } from '../../../../src/modules/buyer/services/address.service';
import { ResourceNotFoundError, ValidationError } from '../../../../src/modules/buyer/domain/errors';
import type { IUserProfileRepository, IAddressRepository } from '../../../../src/modules/buyer/domain/repositories';
import type { UserProfile, Address, UUID } from '../../../../src/modules/buyer/domain/types';
import { mockBuyerId, mockUserProfile, mockAddress1, mockAddress2 } from '../fixtures';

class MockUserProfileRepository implements IUserProfileRepository {
  public profiles: Map<UUID, UserProfile> = new Map();

  async findByUserId(userId: UUID): Promise<UserProfile | null> {
    return this.profiles.get(userId) ?? null;
  }

  async upsert(profile: UserProfile): Promise<UserProfile> {
    this.profiles.set(profile.userId, profile);
    return profile;
  }
}

class MockAddressRepository implements IAddressRepository {
  public addresses: Map<UUID, Address> = new Map();

  async findById(addressId: UUID): Promise<Address | null> {
    return this.addresses.get(addressId) ?? null;
  }

  async findByUserId(userId: UUID): Promise<Address[]> {
    return Array.from(this.addresses.values()).filter(a => a.userId === userId);
  }

  async create(address: Address): Promise<Address> {
    this.addresses.set(address.addressId, address);
    return address;
  }

  async update(address: Address): Promise<Address> {
    this.addresses.set(address.addressId, address);
    return address;
  }

  async delete(addressId: UUID): Promise<void> {
    this.addresses.delete(addressId);
  }

  async setDefault(userId: UUID, targetAddressId: UUID): Promise<void> {
    for (const [id, addr] of this.addresses.entries()) {
      if (addr.userId === userId) {
        this.addresses.set(id, {
          ...addr,
          isDefault: id === targetAddressId,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }
}

describe('ProfileService Tests', () => {
  let profileRepo: MockUserProfileRepository;
  let profileService: ProfileService;

  beforeEach(() => {
    profileRepo = new MockUserProfileRepository();
    profileService = new ProfileService(profileRepo);
  });

  it('getProfile: trả về profile khi tồn tại', async () => {
    await profileRepo.upsert(mockUserProfile);
    const result = await profileService.getProfile(mockBuyerId);
    assert.equal(result.userId, mockBuyerId);
    assert.equal(result.fullName, mockUserProfile.fullName);
  });

  it('getProfile: ném RESOURCE_NOT_FOUND (404) khi profile không tồn tại', async () => {
    await assert.rejects(
      async () => profileService.getProfile('00000000-0000-4000-8000-000000000000'),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('updateProfile: cập nhật thành công profile hợp lệ', async () => {
    await profileRepo.upsert(mockUserProfile);
    const updated = await profileService.updateProfile(mockBuyerId, {
      fullName: 'Nguyễn Văn Đổi Tên',
      phone: '0988776655',
    });
    assert.equal(updated.fullName, 'Nguyễn Văn Đổi Tên');
    assert.equal(updated.phone, '0988776655');
  });

  it('updateProfile: ném VALIDATION_FAILED khi dữ liệu cập nhật không hợp lệ', async () => {
    await assert.rejects(
      async () => profileService.updateProfile(mockBuyerId, {
        phone: '12345678901234567890123', // > 20 ký tự
      }),
      (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
    );
  });
});

describe('AddressService Tests (Ownership & RB-LB05)', () => {
  let addressRepo: MockAddressRepository;
  let addressService: AddressService;
  const otherUserId = '88888888-8888-4888-8888-888888888888';

  beforeEach(() => {
    addressRepo = new MockAddressRepository();
    addressService = new AddressService(addressRepo);
  });

  it('getAddresses: trả về danh sách địa chỉ của chính user', async () => {
    await addressRepo.create(mockAddress1);
    await addressRepo.create(mockAddress2);
    // Địa chỉ của user khác
    await addressRepo.create({ ...mockAddress1, addressId: 'aaaa3333-3333-4333-8333-333333333333', userId: otherUserId });

    const list = await addressService.getAddresses(mockBuyerId);
    assert.equal(list.length, 2);
    assert.ok(list.every(a => a.userId === mockBuyerId));
  });

  it('getAddressById: trả về địa chỉ khi thuộc về chính user', async () => {
    await addressRepo.create(mockAddress1);
    const addr = await addressService.getAddressById(mockBuyerId, mockAddress1.addressId);
    assert.equal(addr.addressId, mockAddress1.addressId);
  });

  it('[auth-rbac-rls.md §3] getAddressById: ném 404 RESOURCE_NOT_FOUND khi địa chỉ không tồn tại', async () => {
    await assert.rejects(
      async () => addressService.getAddressById(mockBuyerId, '00000000-0000-4000-8000-000000000000'),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('[auth-rbac-rls.md §3] getAddressById: ném 404 RESOURCE_NOT_FOUND (không lộ 403) khi truy cập địa chỉ của user khác', async () => {
    // Địa chỉ thuộc về otherUserId
    await addressRepo.create({ ...mockAddress1, userId: otherUserId });

    await assert.rejects(
      async () => addressService.getAddressById(mockBuyerId, mockAddress1.addressId),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('createAddress: tự động đặt isDefault=true cho địa chỉ đầu tiên (UX heuristic)', async () => {
    const created = await addressService.createAddress(mockBuyerId, {
      recipientName: 'Người Nhận 1',
      phone: '0901112233',
      province: 'Hà Nội',
      district: 'Ba Đình',
      ward: 'Điện Biên',
      detailAddress: 'Số 1 Hoàng Diệu',
      // Không truyền isDefault hoặc isDefault: false
    });

    assert.equal(created.isDefault, true);
    assert.equal(created.userId, mockBuyerId);
  });

  it('[RB-LB05] createAddress: thêm địa chỉ thứ 2 có isDefault=true -> địa chỉ cũ tự chuyển isDefault=false', async () => {
    const addr1 = await addressService.createAddress(mockBuyerId, {
      recipientName: 'Địa chỉ 1',
      phone: '0901112233',
      province: 'Hà Nội',
      district: 'Ba Đình',
      ward: 'Điện Biên',
      detailAddress: 'Số 1 Hoàng Diệu',
    });
    assert.equal(addr1.isDefault, true);

    const addr2 = await addressService.createAddress(mockBuyerId, {
      recipientName: 'Địa chỉ 2',
      phone: '0904445566',
      province: 'TP. HCM',
      district: 'Quận 1',
      ward: 'Bến Nghé',
      detailAddress: '123 Lê Lợi',
      isDefault: true,
    });
    assert.equal(addr2.isDefault, true);

    // Kiểm tra addr1 đã bị hạ cờ default
    const reloadedAddr1 = await addressRepo.findById(addr1.addressId);
    assert.equal(reloadedAddr1?.isDefault, false);
  });

  it('[RB-LB05] createAddress: ném VALIDATION_FAILED khi user đã có 10 địa chỉ (tối đa 10 địa chỉ/User)', async () => {
    // Tạo 10 địa chỉ
    for (let i = 0; i < 10; i++) {
      await addressRepo.create({
        ...mockAddress1,
        addressId: `aaaa0000-0000-4000-8000-00000000000${i}`,
        userId: mockBuyerId,
        isDefault: i === 0,
      });
    }

    await assert.rejects(
      async () => addressService.createAddress(mockBuyerId, {
        recipientName: 'Địa chỉ 11',
        phone: '0909999999',
        province: 'Đà Nẵng',
        district: 'Hải Châu',
        ward: 'Hải Châu 1',
        detailAddress: '99 Bạch Đằng',
      }),
      (err: unknown) => err instanceof ValidationError && err.code === 'VALIDATION_FAILED'
    );
  });

  it('[auth-rbac-rls.md §3] updateAddress: ném 404 RESOURCE_NOT_FOUND khi sửa địa chỉ của user khác', async () => {
    await addressRepo.create({ ...mockAddress1, userId: otherUserId });

    await assert.rejects(
      async () => addressService.updateAddress(mockBuyerId, mockAddress1.addressId, {
        recipientName: 'Hacker Name',
      }),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('updateAddress: cập nhật thông tin và chuyển default hợp lệ', async () => {
    await addressRepo.create(mockAddress1);
    await addressRepo.create(mockAddress2);

    const updated = await addressService.updateAddress(mockBuyerId, mockAddress2.addressId, {
      recipientName: 'Công ty Mới',
      isDefault: true,
    });

    assert.equal(updated.recipientName, 'Công ty Mới');
    assert.equal(updated.isDefault, true);

    const addr1 = await addressRepo.findById(mockAddress1.addressId);
    assert.equal(addr1?.isDefault, false);
  });

  it('[auth-rbac-rls.md §3] deleteAddress: ném 404 RESOURCE_NOT_FOUND khi xoá địa chỉ của user khác', async () => {
    await addressRepo.create({ ...mockAddress1, userId: otherUserId });

    await assert.rejects(
      async () => addressService.deleteAddress(mockBuyerId, mockAddress1.addressId),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('deleteAddress: xoá thành công địa chỉ của chính user', async () => {
    await addressRepo.create(mockAddress1);
    await addressService.deleteAddress(mockBuyerId, mockAddress1.addressId);
    const found = await addressRepo.findById(mockAddress1.addressId);
    assert.equal(found, null);
  });

  it('[auth-rbac-rls.md §3] setDefault: ném 404 RESOURCE_NOT_FOUND khi setDefault địa chỉ của user khác', async () => {
    await addressRepo.create({ ...mockAddress1, userId: otherUserId });

    await assert.rejects(
      async () => addressService.setDefault(mockBuyerId, mockAddress1.addressId),
      (err: unknown) => err instanceof ResourceNotFoundError && err.code === 'RESOURCE_NOT_FOUND'
    );
  });

  it('setDefault: đổi địa chỉ default thành công', async () => {
    await addressRepo.create(mockAddress1); // isDefault: true
    await addressRepo.create(mockAddress2); // isDefault: false

    await addressService.setDefault(mockBuyerId, mockAddress2.addressId);

    const a1 = await addressRepo.findById(mockAddress1.addressId);
    const a2 = await addressRepo.findById(mockAddress2.addressId);
    assert.equal(a1?.isDefault, false);
    assert.equal(a2?.isDefault, true);
  });
});
