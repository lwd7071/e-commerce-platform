// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SellerReportsScreen } from '@/features/seller/seller-reports-screen';
import { repositories } from '@/lib/repositories/repository-factory';

const mockReport = {
  grossRevenue: '2500000.00',
  completedOrders: 15,
  averageOrderValue: '166666.67',
  totalOrders: 20,
  cancelledOrders: 3,
  otherOrders: 2,
  generatedAt: '2026-10-01T12:00:00.000Z',
};

const mockSellerRepo = {
  getRevenueReport: vi.fn(),
  getKpiSummary: vi.fn(),
};

vi.mock('@/lib/repositories/repository-factory', () => ({
  repositories: {
    seller: () => mockSellerRepo,
  },
}));

describe('SellerReportsScreen UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders report form with date filters and button', () => {
    render(<SellerReportsScreen />);

    expect(screen.getByText('Báo cáo doanh thu')).toBeTruthy();
    expect(screen.getByLabelText(/Từ ngày/)).toBeTruthy();
    expect(screen.getByLabelText(/Đến ngày/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Xem báo cáo' })).toBeTruthy();
  });

  it('submits date filter and displays revenue report', async () => {
    mockSellerRepo.getRevenueReport.mockResolvedValueOnce(mockReport);

    const user = userEvent.setup();
    render(<SellerReportsScreen />);

    await user.type(screen.getByLabelText(/Từ ngày/), '2026-10-01');
    await user.type(screen.getByLabelText(/Đến ngày/), '2026-10-05');
    await user.click(screen.getByRole('button', { name: 'Xem báo cáo' }));

    await waitFor(() => {
      expect(mockSellerRepo.getRevenueReport).toHaveBeenCalledWith({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-05T23:59:59.999Z',
      });
    });

    expect(await screen.findByText('2.500.000 ₫')).toBeTruthy();
    expect(screen.getByText('15')).toBeTruthy();
    expect(screen.getByText('20')).toBeTruthy();
    expect(screen.getByText(/3 đã hủy · 2 trạng thái khác/)).toBeTruthy();
  });
});
