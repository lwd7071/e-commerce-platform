// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: vi.fn() }));
vi.mock('@/features/notifications/notification-popover', () => ({ NotificationPopover: () => null }));

vi.stubEnv('NEXT_PUBLIC_USE_MOCK', 'false');
const { useAuth } = await import('@/lib/auth/auth-context');
const { HomeMarketplaceContent } = await import('@/features/catalog/home-marketplace-content');
const { SiteHeader } = await import('@/components/navigation/site-navigation');

const mockUseAuth = vi.mocked(useAuth);
const originalFetch = global.fetch;
const platformVoucher = {
  voucherId: 'platform-1', code: 'GLOBAL50', voucherName: 'Ưu đãi toàn sàn', scope: 'PLATFORM', shopId: null,
  discountType: 'FIXED', discountValue: '50000.00', maxDiscount: null, minOrderValue: '300000.00',
  quantity: 10, startAt: '2026-10-01T00:00:00Z', endAt: '2026-11-01T00:00:00Z', status: 'ACTIVE',
};
const shopVoucher = {
  ...platformVoucher, voucherId: 'shop-1', code: 'SHOP50', voucherName: 'Voucher Shop Dino Tech',
  scope: 'SHOP', shopId: 'shop-123', minOrderValue: '500000.00',
};

function jsonResponse(data: unknown, paginated = false) {
  return new Response(JSON.stringify(paginated
    ? { data, meta: { limit: 20, has_more: false, next_cursor: null }, request_id: 'req-test' }
    : { data, request_id: 'req-test' }), { status: 200, headers: { 'content-type': 'application/json' } });
}

function useLiveResponses() {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/vouchers/public')) return jsonResponse([
      { voucherId: 'platform-1', code: 'GLOBAL50', voucherName: 'Ưu đãi toàn sàn', discountType: 'FIXED', discountValue: '50000.00', maxDiscount: null, minOrderValue: '300000.00', startAt: platformVoucher.startAt, endAt: platformVoucher.endAt },
      { voucherId: 'platform-2', code: 'GLOBAL20', voucherName: 'Ưu đãi tiếp theo', discountType: 'PERCENT', discountValue: '20.00', maxDiscount: '50000.00', minOrderValue: '100000.00', startAt: platformVoucher.startAt, endAt: platformVoucher.endAt },
    ]);
    if (url.includes('/vouchers/applicable')) return jsonResponse([platformVoucher, shopVoucher]);
    if (url.includes('/products')) return jsonResponse([], true);
    throw new Error(`Unexpected request: ${url}`);
  });
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'buyer-1', email: 'buyer@example.test', role: 'BUYER' }, isLoading: false, logout: vi.fn() } as never);
  useLiveResponses();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('Home vouchers and announcement', () => {
  it('links a shop voucher to its shop storefront', async () => {
    render(<HomeMarketplaceContent />);

    const shopTicket = await screen.findByRole('link', { name: /Voucher Shop Dino Tech.*Mở gian hàng/i });
    expect(shopTicket.getAttribute('href')).toBe('/shops/shop-123');
    expect(screen.queryByRole('link', { name: /GLOBAL50/i })).toBeNull();
  });

  it('shows public platform voucher details to guests and rotates them with a pause control', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() } as never);
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<SiteHeader />);

    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('GLOBAL50')).toBeTruthy();
    expect(screen.getByText(/Đơn từ 300\.000/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Xem voucher' }).getAttribute('href')).toBe('/#uu-dai');
    expect(screen.queryByText('SHOP50')).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạm dừng luân phiên ưu đãi' })).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('GLOBAL20')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng luân phiên ưu đãi' }));
    expect(screen.getByRole('button', { name: 'Tiếp tục luân phiên ưu đãi' })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(screen.getByText('GLOBAL20')).toBeTruthy();
  });

  it('pauses while the announcement is hovered or keyboard-focused', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() } as never);
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const { container } = render(<SiteHeader />);

    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const announcement = container.querySelector('.site-header__announcement-content')!;
    fireEvent.mouseEnter(announcement);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('GLOBAL50')).toBeTruthy();
    fireEvent.mouseLeave(announcement);
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('GLOBAL20')).toBeTruthy();

    fireEvent.focus(screen.getByRole('button', { name: 'Voucher tiếp theo' }));
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText('GLOBAL20')).toBeTruthy();
  });

  it('does not auto-rotate when reduced motion is requested', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false, logout: vi.fn() } as never);
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/vouchers/public')) return jsonResponse([
        { voucherId: 'a', code: 'GLOBAL50', voucherName: 'Ưu đãi đầu', discountType: 'FIXED', discountValue: '50000', maxDiscount: null, minOrderValue: '300000', startAt: platformVoucher.startAt, endAt: platformVoucher.endAt },
        { voucherId: 'b', code: 'GLOBAL20', voucherName: 'Ưu đãi kế', discountType: 'PERCENT', discountValue: '20', maxDiscount: '50000', minOrderValue: '100000', startAt: platformVoucher.startAt, endAt: platformVoucher.endAt },
      ]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.useFakeTimers();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    render(<SiteHeader />);

    await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText('GLOBAL50')).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(15000); });
    expect(screen.getByText('GLOBAL50')).toBeTruthy();
  });
});
