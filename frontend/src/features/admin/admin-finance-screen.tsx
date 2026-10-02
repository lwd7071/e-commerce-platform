"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { walletApi, type FinanceOverview, type WithdrawalRequest } from "@/lib/api/wallet.api";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { Skeleton, ErrorState, EmptyState } from "@/components/ui/data-states";

export function AdminFinanceScreen() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dialogs
  const [selectedReq, setSelectedReq] = useState<WithdrawalRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<"approve" | "reject" | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filter = statusFilter === "ALL" ? undefined : { status: statusFilter };
      const [overviewData, withdrawData] = await Promise.all([
        walletApi.getFinanceOverview(),
        walletApi.getAdminWithdrawals(filter),
      ]);
      setOverview(overviewData);
      setWithdrawals(withdrawData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải báo cáo tài chính sàn.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleConfirmAction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReq || !dialogAction) return;

    setSubmitting(true);
    setError(null);
    try {
      if (dialogAction === "approve") {
        await walletApi.approveWithdrawal(selectedReq.request_id, adminNote || "Admin đã chuyển khoản thành công");
        setNotice(`Đã duyệt chi tiền thành công cho yêu cầu #${selectedReq.request_id.slice(0, 8)}`);
      } else {
        await walletApi.rejectWithdrawal(selectedReq.request_id, adminNote || "Từ chối yêu cầu rút tiền");
        setNotice(`Đã từ chối và hoàn tiền về ví cho yêu cầu #${selectedReq.request_id.slice(0, 8)}`);
      }
      setDialogAction(null);
      setSelectedReq(null);
      setAdminNote("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-8 sm:px-6">
      {/* Sub-nav tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-4">
        <Link href="/admin" className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--subtext)] hover:bg-[var(--card-muted)] flex items-center gap-1">
          ← Quay lại Dashboard
        </Link>
        <Link href="/admin/orders" className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--subtext)] hover:bg-[var(--card-muted)]">
          Đơn hàng
        </Link>
        <Link href="/admin/finance" className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-sm">
          Tài chính & Ví sàn
        </Link>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">Quản lý Tài chính & Ký quỹ sàn (Escrow)</h1>
        <p className="text-sm text-[var(--subtext)]">
          Theo dõi toàn bộ dòng tiền ký quỹ, doanh thu phí sàn (5%), và duyệt lệnh rút tiền của các gian hàng.
        </p>
      </header>

      {notice && (
        <div className="rounded-xl border border-[var(--success-border)] bg-[var(--success-surface)] p-4 text-sm font-medium text-[var(--success)] flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-sm hover:underline">Đóng</button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-surface)] p-4 text-sm font-medium text-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Overview Cards */}
      {loading && !overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton height={120} className="rounded-2xl" />
          <Skeleton height={120} className="rounded-2xl" />
          <Skeleton height={120} className="rounded-2xl" />
          <Skeleton height={120} className="rounded-2xl" />
        </div>
      )}

      {!loading && overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Tiền Ký quỹ đang giữ</span>
            <div className="mt-2 text-2xl font-black text-[var(--foreground)]">
              {moneyAdapter.formatVND(overview.total_escrow_holding)}
            </div>
            <p className="mt-3 text-xs text-[var(--subtext)]">Tiền đơn hàng chưa hoàn tất</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Hoa hồng sàn đã thu (5%)</span>
            <div className="mt-2 text-2xl font-black text-[var(--success)]">
              {moneyAdapter.formatVND(overview.total_commission_collected)}
            </div>
            <p className="mt-3 text-xs text-[var(--subtext)]">Doanh thu thực tế của Sàn</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Tổng số dư trong ví Shop</span>
            <div className="mt-2 text-2xl font-black text-[var(--foreground)]">
              {moneyAdapter.formatVND(overview.total_wallets_balance)}
            </div>
            <p className="mt-3 text-xs text-[var(--subtext)]">Nghĩa vụ phải chi trả cho Shop</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Tổng tiền đã chi trả (Payout)</span>
            <div className="mt-2 text-2xl font-black text-[var(--info)]">
              {moneyAdapter.formatVND(overview.total_withdrawn)}
            </div>
            <p className="mt-3 text-xs text-[var(--subtext)]">Lệnh chờ duyệt: <strong className="text-[var(--warning)]">{overview.pending_withdrawals_count}</strong></p>
          </div>
        </div>
      )}

      {/* Filter and Table */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Danh sách Yêu cầu rút tiền từ Shop</h2>
          <div className="flex gap-2">
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                  statusFilter === st
                    ? "bg-[var(--primary)] text-white"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--subtext)] hover:bg-[var(--card-muted)]"
                }`}
              >
                {st === "ALL" && "Tất cả"}
                {st === "PENDING" && "Chờ duyệt"}
                {st === "APPROVED" && "Đã duyệt"}
                {st === "REJECTED" && "Từ chối"}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
          {withdrawals.length === 0 ? (
            <div className="p-8">
              <EmptyState title="Không có yêu cầu rút tiền" description="Không tìm thấy yêu cầu rút tiền nào phù hợp với bộ lọc." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--card-muted)] border-b border-[var(--border)] text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã yêu cầu</th>
                    <th className="px-5 py-3.5">Gian hàng</th>
                    <th className="px-5 py-3.5">Số tiền yêu cầu</th>
                    <th className="px-5 py-3.5">Tài khoản nhận tiền</th>
                    <th className="px-5 py-3.5">Ngày yêu cầu</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {withdrawals.map((req) => (
                    <tr key={req.request_id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-[var(--foreground)]">
                        #{req.request_id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-[var(--subtext)]">
                        Shop #{req.shop_id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-[var(--foreground)]">
                        {moneyAdapter.formatVND(req.amount)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--subtext)]">
                        <div><strong className="text-[var(--foreground)]">{req.bank_name}</strong> - {req.bank_account_number}</div>
                        <div className="uppercase font-medium text-[11px]">{req.bank_account_holder}</div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--subtext)]">
                        {new Date(req.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {req.status === "PENDING" && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--warning-surface)] text-[var(--warning)]">
                            Chờ duyệt
                          </span>
                        )}
                        {req.status === "APPROVED" && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--success-surface)] text-[var(--success)]">
                            Đã chuyển tiền
                          </span>
                        )}
                        {req.status === "REJECTED" && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--danger-surface)] text-[var(--danger)]">
                            Đã từ chối
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {req.status === "PENDING" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="primary"
                              className="text-xs py-1.5 px-3"
                              onClick={() => {
                                setSelectedReq(req);
                                setDialogAction("approve");
                                setAdminNote("");
                              }}
                            >
                              Duyệt & Chi tiền
                            </Button>
                            <Button
                              variant="danger"
                              className="text-xs py-1.5 px-3"
                              onClick={() => {
                                setSelectedReq(req);
                                setDialogAction("reject");
                                setAdminNote("");
                              }}
                            >
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--subtext)]">{req.admin_note || "Đã hoàn tất"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(selectedReq && dialogAction)}
        onOpenChange={(open) => { if (!open) { setSelectedReq(null); setDialogAction(null); } }}
        title={dialogAction === "approve" ? "Xác nhận duyệt chuyển tiền" : "Từ chối yêu cầu rút tiền"}
        description={
          dialogAction === "approve"
            ? `Bạn xác nhận đã chuyển khoản ${moneyAdapter.formatVND(selectedReq?.amount || "0")} đến tài khoản ${selectedReq?.bank_name} - ${selectedReq?.bank_account_number} (${selectedReq?.bank_account_holder})?`
            : `Hệ thống sẽ hoàn trả ${moneyAdapter.formatVND(selectedReq?.amount || "0")} về số dư khả dụng của gian hàng.`
        }
      >
        <form onSubmit={handleConfirmAction} className="space-y-4">
          <FormField
            id="admin_note"
            label={dialogAction === "approve" ? "Mã giao dịch / Ghi chú (tùy chọn)" : "Lý do từ chối (bắt buộc)"}
          >
            <TextInput
              id="admin_note"
              placeholder={dialogAction === "approve" ? "Ví dụ: FT12345678 qua VietQR" : "Ví dụ: Sai số tài khoản hoặc tên chủ tài khoản"}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              required={dialogAction === "reject"}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => { setSelectedReq(null); setDialogAction(null); }} type="button">
              Hủy
            </Button>
            <Button
              variant={dialogAction === "approve" ? "primary" : "danger"}
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Đang xử lý..." : dialogAction === "approve" ? "Xác nhận đã chi tiền" : "Xác nhận từ chối"}
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
