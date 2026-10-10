"use client";

import { useEffect, useId, useState } from 'react';
import { locationsApi, type AdministrativeLocation } from '@/lib/api/locations.api';

interface Props {
  provinceCode: string;
  provinceName?: string;
  wardCode: string;
  wardName?: string;
  onProvinceChange(code: string, name: string): void;
  onWardChange(code: string, name: string): void;
  locality?: string;
  onLocalityChange?(value: string): void;
}

const inputClass = 'w-full rounded-xl border border-[var(--border)] bg-[var(--background)] p-2.5 text-[var(--foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary-active)] disabled:cursor-not-allowed disabled:opacity-60';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLocaleLowerCase('vi').trim();
}

function LocationAutocomplete({
  label, placeholder, value, options, disabled, onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: AdministrativeLocation[];
  disabled?: boolean;
  onChange(code: string, name: string): void;
}) {
  const id = useId();
  const [query, setQuery] = useState(value);
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setQuery(value);
  }
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const filtered = query.trim()
    ? options.filter(option => normalize(option.name).includes(normalize(query))).slice(0, 8)
    : options.slice(0, 8);

  const choose = (option: AdministrativeLocation) => {
    setQuery(option.name);
    onChange(option.code, option.name);
    setOpen(false);
    setActiveIndex(-1);
  };

  return <div className="field-stack relative">
    <label htmlFor={id} className="field-label">{label}</label>
    <input
      id={id}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open && filtered.length > 0}
      aria-controls={`${id}-options`}
      aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={query}
      className={inputClass}
      onFocus={() => { setOpen(true); setActiveIndex(-1); }}
      onChange={event => {
        const next = event.target.value;
        const match = options.find(option => normalize(option.name) === normalize(next));
        setQuery(next);
        onChange(match?.code ?? '', next);
        setOpen(true);
        setActiveIndex(-1);
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' && filtered.length) {
          event.preventDefault(); setOpen(true); setActiveIndex(index => (index + 1) % filtered.length);
        } else if (event.key === 'ArrowUp' && filtered.length) {
          event.preventDefault(); setOpen(true); setActiveIndex(index => index <= 0 ? filtered.length - 1 : index - 1);
        } else if (event.key === 'Enter' && open) {
          event.preventDefault();
          if (activeIndex >= 0 && filtered[activeIndex]) choose(filtered[activeIndex]);
        } else if (event.key === 'Escape') {
          setOpen(false); setActiveIndex(-1);
        }
      }}
      onBlur={() => { setOpen(false); setActiveIndex(-1); }}
    />
    {open && filtered.length > 0 && !disabled && <ul id={`${id}-options`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-1 shadow-lg">
      {filtered.map((option, index) => <li
        key={option.code}
        id={`${id}-option-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${index === activeIndex ? 'bg-[var(--primary-surface)] text-[var(--primary-active)]' : 'hover:bg-[var(--primary-surface)]'}`}
        onMouseDown={event => event.preventDefault()}
        onClick={() => choose(option)}
      >{option.name}</li>)}
    </ul>}
  </div>;
}

export function AdministrativeAddressFields({
    provinceCode, provinceName = '', wardCode, wardName = '', onProvinceChange, onWardChange, locality, onLocalityChange,
}: Props) {
  const [provinces, setProvinces] = useState<AdministrativeLocation[]>([]);
  const [wardCatalog, setWardCatalog] = useState<{ provinceCode: string; wards: AdministrativeLocation[] }>({ provinceCode: '', wards: [] });
  const [error, setError] = useState('');
  const wards = wardCatalog.provinceCode === provinceCode ? wardCatalog.wards : [];
  const selectedProvinceName = provinceName || provinces.find(item => item.code === provinceCode)?.name || '';
  const selectedWardName = wardName || wards.find(item => item.code === wardCode)?.name || '';

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
    <LocationAutocomplete label="Tỉnh/thành phố" placeholder="Nhập để tìm tỉnh/thành phố" value={selectedProvinceName} options={provinces} onChange={onProvinceChange} />
    <LocationAutocomplete label="Phường/xã" placeholder={provinceCode ? 'Nhập để tìm phường/xã' : 'Chọn tỉnh/thành trước'} value={selectedWardName} options={wards} disabled={!provinceCode || wards.length === 0} onChange={onWardChange} />
    {onLocalityChange && <label className="field-stack sm:col-span-2">
      <span className="field-label">Thôn/ấp/tổ dân phố</span>
      <input autoComplete="address-line2" placeholder="Ví dụ: Ấp 3, thôn Đông hoặc tổ 12" value={locality ?? ''} onChange={event => onLocalityChange(event.target.value)} className={inputClass} />
    </label>}
    {error && <p className="text-sm text-[var(--danger)] sm:col-span-2" role="alert">{error}</p>}
  </div>;
}
