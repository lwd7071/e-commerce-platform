"use client";

import { useEffect, useState } from 'react';
import { locationsApi, type AdministrativeLocation } from '@/lib/api/locations.api';

interface Props {
  provinceCode: string;
  wardCode: string;
  onProvinceChange(code: string, name: string): void;
  onWardChange(code: string, name: string): void;
}

const selectClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2.5 text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-active)]';

export function AdministrativeAddressFields({ provinceCode, wardCode, onProvinceChange, onWardChange }: Props) {
  const [provinces, setProvinces] = useState<AdministrativeLocation[]>([]);
  const [wardCatalog, setWardCatalog] = useState<{ provinceCode: string; wards: AdministrativeLocation[] }>({ provinceCode: '', wards: [] });
  const [error, setError] = useState('');
  const wards = wardCatalog.provinceCode === provinceCode ? wardCatalog.wards : [];

  useEffect(() => {
    let active = true;
    void locationsApi.provinces().then(value => { if (active) setProvinces(value); }).catch(() => { if (active) setError('Không tải được danh mục tỉnh/thành.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!provinceCode) return;
    let active = true;
    void locationsApi.wards(provinceCode).then(value => { if (active) setWardCatalog({ provinceCode, wards: value }); }).catch(() => { if (active) setError('Không tải được danh mục phường/xã.'); });
    return () => { active = false; };
  }, [provinceCode]);

  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="field-stack"><span className="field-label">Tỉnh/thành phố</span><select aria-label="Tỉnh/thành phố" required value={provinceCode} onChange={event => { const row = provinces.find(item => item.code === event.target.value); onProvinceChange(event.target.value, row?.name ?? ''); onWardChange('', ''); }} className={selectClass}>
      <option value="">Chọn tỉnh/thành phố</option>{provinces.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select></label>
    <label className="field-stack"><span className="field-label">Phường/xã</span><select aria-label="Phường/xã" required disabled={!provinceCode || wards.length === 0} value={wardCode} onChange={event => { const row = wards.find(item => item.code === event.target.value); onWardChange(event.target.value, row?.name ?? ''); }} className={selectClass}>
      <option value="">{provinceCode ? 'Chọn phường/xã' : 'Chọn tỉnh/thành trước'}</option>{wards.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
    </select></label>
    {error && <p className="text-sm text-[var(--danger)] sm:col-span-2" role="alert">{error}</p>}
  </div>;
}
