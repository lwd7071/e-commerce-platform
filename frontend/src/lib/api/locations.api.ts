import { apiClient } from './client';

export interface AdministrativeLocation { code: string; name: string; province_code?: string }

export const locationsApi = {
  provinces: () => apiClient.get<AdministrativeLocation[]>('/locations/provinces'),
  wards: (provinceCode: string) => apiClient.get<AdministrativeLocation[]>(`/locations/provinces/${encodeURIComponent(provinceCode)}/wards`),
};
