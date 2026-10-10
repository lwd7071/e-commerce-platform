import type { RequestContext } from '../../../platform/context/request-context.ts';
import { ForbiddenError, NotFoundError, ValidationFailedError } from '../../../platform/errors/app-error.ts';
import type { ISellerShopRepository, SellerShop, SellerShopUpdate } from '../domain/shop.types.ts';
import { resolveAdministrativeAddress } from '../../shipping/locations.ts';

const editableFields = ['shop_name', 'description', 'pickup_address', 'pickup_province', 'pickup_province_code', 'pickup_ward', 'pickup_ward_code', 'pickup_detail_address', 'contact_phone'] as const;

export class SellerShopService {
  constructor(private readonly repository: ISellerShopRepository) {}

  async get(context: RequestContext): Promise<SellerShop> {
    return this.requireShop(await this.repository.findOwned(context));
  }

  async update(context: RequestContext, input: Record<string, unknown>): Promise<SellerShop> {
    if (!context.shop_id) throw new NotFoundError('Seller shop not found');
    const update = this.validate(input);
    const current = this.requireShop(await this.repository.findOwned(context));
    if (current.status !== 'PENDING' && current.status !== 'ACTIVE') {
      throw new ForbiddenError('SHOP_PROFILE_READ_ONLY', 'Shop profile cannot be edited while the shop is suspended or locked');
    }
    const address = update.pickup_address === undefined ? current.pickup_address : update.pickup_address;
    const phone = update.contact_phone === undefined ? current.contact_phone : update.contact_phone;
    if (current.status === 'ACTIVE' && (!address?.trim() || !phone?.trim())) {
      throw new ValidationFailedError('An active shop must keep its pickup address and contact phone', {
        fields: ['pickup_address', 'contact_phone'],
      });
    }
    const saved = await this.repository.updateOwned(context, update);
    if (!saved) throw new ForbiddenError('SHOP_PROFILE_READ_ONLY', 'Shop profile cannot be edited in its current state');
    return saved;
  }

  private validate(input: Record<string, unknown>): SellerShopUpdate {
    const keys = Object.keys(input);
    if (keys.length === 0) throw new ValidationFailedError('At least one shop field is required');
    const unknown = keys.find((key) => !editableFields.includes(key as typeof editableFields[number]));
    if (unknown) throw new ValidationFailedError(`Unknown field: ${unknown}`, { field: unknown });
    const update: SellerShopUpdate = {};
    for (const key of editableFields) {
      if (!(key in input)) continue;
      const value = input[key];
      if (key === 'shop_name') {
        if (typeof value !== 'string' || value.trim().length < 2 || value.trim().length > 150) {
          throw new ValidationFailedError('Shop name must contain 2 to 150 characters', { field: key });
        }
        update.shop_name = value.trim();
      } else if (key === 'description') {
        if (value !== null && typeof value !== 'string') throw new ValidationFailedError('Description must be a string or null', { field: key });
        update.description = typeof value === 'string' ? value.trim() : null;
      } else if (key === 'pickup_province_code' || key === 'pickup_ward_code') {
        if (typeof value !== 'string' || !value.trim() || value.length > 10) throw new ValidationFailedError(`${key} must be a valid administrative code`, { field: key });
        if (key === 'pickup_province_code') update.pickup_province_code = value.trim();
        else update.pickup_ward_code = value.trim();
      } else {
        if (value !== null && typeof value !== 'string') throw new ValidationFailedError(`${key} must be a string or null`, { field: key });
        const text = typeof value === 'string' ? value.trim() : null;
        const maxLength = key.startsWith('pickup_') ? 255 : 20;
        if (text !== null && text.length > maxLength) throw new ValidationFailedError(`${key} exceeds ${maxLength} characters`, { field: key });
        if (key === 'pickup_address') update.pickup_address = text;
        else if (key === 'pickup_province') update.pickup_province = text;
        else if (key === 'pickup_ward') update.pickup_ward = text;
        else if (key === 'pickup_detail_address') update.pickup_detail_address = text;
        else update.contact_phone = text;
      }
    }
    const provinceCode = update.pickup_province_code;
    const wardCode = update.pickup_ward_code;
    if ((provinceCode === undefined) !== (wardCode === undefined)) throw new ValidationFailedError('pickup_province_code and pickup_ward_code must be provided together.');
    if (provinceCode && wardCode) {
      const labels = resolveAdministrativeAddress(provinceCode, wardCode);
      update.pickup_province = labels.province;
      update.pickup_ward = labels.ward;
    }
    return update;
  }

  private requireShop(shop: SellerShop | null): SellerShop {
    if (!shop) throw new NotFoundError('Seller shop not found');
    return shop;
  }
}
