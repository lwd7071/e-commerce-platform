import catalog from './data/vn-admin-catalog.json' with { type: 'json' };
import { ValidationFailedError } from '../../platform/errors/app-error.ts';

export interface AdministrativeLocation {
  readonly code: string;
  readonly name: string;
  readonly province_code?: string;
}

const provinces = catalog.provinces.map(({ code, name }) => ({ code, name }));
const wards = catalog.wards.map(({ code, name, provinceCode }) => ({ code, name, province_code: provinceCode }));
const provinceByCode = new Map(provinces.map(province => [province.code, province]));
const wardByCode = new Map(wards.map(ward => [ward.code, ward]));

export function listProvinces(): readonly AdministrativeLocation[] {
  return provinces;
}

export function listWards(provinceCode: string): readonly AdministrativeLocation[] {
  if (!provinceByCode.has(provinceCode)) throw new ValidationFailedError('Unknown province_code.', { field: 'province_code' });
  return wards.filter(ward => ward.province_code === provinceCode);
}

export function resolveAdministrativeAddress(provinceCode: string, wardCode: string): { province: string; ward: string } {
  const province = provinceByCode.get(provinceCode);
  const ward = wardByCode.get(wardCode);
  if (!province || !ward || ward.province_code !== provinceCode) {
    throw new ValidationFailedError('ward_code does not belong to province_code.', { fields: ['province_code', 'ward_code'] });
  }
  return { province: province.name, ward: ward.name };
}

export function getAdministrativeCatalogCounts(): { provinces: number; wards: number } {
  return { provinces: provinces.length, wards: wards.length };
}
