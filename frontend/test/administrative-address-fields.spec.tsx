// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AdministrativeAddressFields } from '@/components/forms/administrative-address-fields';

vi.mock('@/lib/api/locations.api', () => ({
  locationsApi: {
    provinces: vi.fn().mockResolvedValue([
      { code: '01', name: 'Hà Nội' },
      { code: '79', name: 'Hồ Chí Minh' },
    ]),
    wards: vi.fn().mockImplementation((code: string) => {
      if (code === '01') {
        return Promise.resolve([
          { code: '00004', name: 'Ba Đình', province_code: '01' },
          { code: '00070', name: 'Hoàn Kiếm', province_code: '01' },
        ]);
      }
      return Promise.resolve([
        { code: '26734', name: 'Bến Nghé', province_code: '79' },
      ]);
    }),
  },
}));

function ControlledAddressWrapper() {
  const [address, setAddress] = useState({
    provinceCode: '',
    province: '',
    wardCode: '',
    ward: '',
  });

  return (
    <div>
      <AdministrativeAddressFields
        provinceCode={address.provinceCode}
        wardCode={address.wardCode}
        onProvinceChange={(code, name) =>
          setAddress(prev => ({
            ...prev,
            provinceCode: code,
            province: name,
            wardCode: '',
            ward: '',
          }))
        }
        onWardChange={(code, name) =>
          setAddress(prev => ({
            ...prev,
            wardCode: code,
            ward: name,
          }))
        }
      />
      <div data-testid="selected-province">{address.provinceCode} - {address.province}</div>
      <div data-testid="selected-ward">{address.wardCode} - {address.ward}</div>
    </div>
  );
}

describe('AdministrativeAddressFields', () => {
  it('allows user to select a province and then a ward without resetting state', async () => {
    const user = userEvent.setup();
    render(<ControlledAddressWrapper />);

    // Chờ danh sách tỉnh tải xong
    const provinceSelect = await screen.findByRole('combobox', { name: 'Tỉnh/thành phố' });
    expect(provinceSelect).toBeTruthy();

    // Chọn Hà Nội (code 01)
    await user.selectOptions(provinceSelect, '01');

    // Kiểm tra state và select đã cập nhật
    expect(screen.getByTestId('selected-province').textContent).toBe('01 - Hà Nội');
    expect((provinceSelect as HTMLSelectElement).value).toBe('01');

    // Chờ danh sách phường/xã của Hà Nội tải về
    const wardSelect = await screen.findByRole('combobox', { name: 'Phường/xã' });
    await waitFor(() => {
      expect((wardSelect as HTMLSelectElement).disabled).toBe(false);
    });

    // Chọn Ba Đình (code 00004)
    await user.selectOptions(wardSelect, '00004');

    expect(screen.getByTestId('selected-ward').textContent).toBe('00004 - Ba Đình');
    expect((wardSelect as HTMLSelectElement).value).toBe('00004');
  });
});
