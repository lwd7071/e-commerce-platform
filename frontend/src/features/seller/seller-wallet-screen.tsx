"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { walletApi, type ShopWallet, type WalletTransaction, type WithdrawalRequest } from "@/lib/api/wallet.api";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { Skeleton, EmptyState } from "@/components/ui/data-states";

export function SellerWalletScreen() {
  const [wallet, setWallet] = useState<ShopWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Active view tab: transactions vs withdrawals
  const [activeTab, setActiveTab] = useState<"transactions" | "withdrawals">("transactions");

  // Modals
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: "", bank_account_number: "", bank_account_holder: "" });
  const [savingBank, setSavingBank] = useState(false);

  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [requestingWithdraw, setRequestingWithdraw] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletData, txData, withdrawData] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(50),
        walletApi.getWithdrawals(),
      ]);
      setWallet(walletData);
      setTransactions(txData);
      setWithdrawals(withdrawData);
      if (walletData.bank_name) {
        setBankForm({
          bank_name: walletData.bank_name,
          bank_account_number: walletData.bank_account_number || "",
          bank_account_holder: walletData.bank_account_holder || "",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải dữ liệu ví.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault();
    setSavingBank(true);
    setError(null);
    try {
      const updated = await walletApi.updateBankInfo(bankForm);
      setWallet(updated);
      setBankModalOpen(false);
      setNotice("Đã cập nhật thông tin tài khoản ngân hàng thành công.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật ngân hàng thất bại.");
    } finally {
      setSavingBank(false);
    }
  }

  async function handleRequestWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setRequestingWithdraw(true);
    setError(null);
    try {
      await walletApi.requestWithdrawal(withdrawAmount);
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
      setNotice("Yêu cầu rút tiền đã được gửi. Admin sẽ duyệt trong 24h.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi yêu cầu rút tiền thất bại.");
    } finally {
      setRequestingWithdraw(false);
    }
  }

  const availableBalanceNum = wallet ? Number(wallet.balance) : 0;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <Link href="/seller" className="text-sm font-medium text-[var(--primary)] hover:underline inline-flex items-center gap-1">
          ← Kênh người bán
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">Ví người bán (Escrow & Wallet)</h1>
            <p className="mt-1 text-sm text-[var(--subtext)]">
              Tiền từ đơn hàng hoàn tất sẽ tự động trừ 5% phí sàn và chuyển vào Số dư khả dụng.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => setWithdrawModalOpen(true)}
            disabled={!wallet || availableBalanceNum < 50000 || !wallet.bank_account_number}
          >
            <Icon name="check" className="w-4 h-4 mr-1.5" />
            Yêu cầu rút tiền
          </Button>
        </div>
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

      {loading && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton height={130} className="rounded-2xl" />
          <Skeleton height={130} className="rounded-2xl" />
          <Skeleton height={130} className="rounded-2xl" />
        </div>
      )}

      {!loading && wallet && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1: Số dư khả dụng */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Số dư khả dụng</span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-[var(--foreground)]">
                {moneyAdapter.formatVND(wallet.balance)}
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--subtext)]">Có thể rút về tài khoản bất kỳ lúc nào</p>
          </div>

          {/* Card 2: Đang xử lý rút */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Đang xử lý rút tiền</span>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-[var(--warning)]">
                {moneyAdapter.formatVND(wallet.hold_balance)}
              </div>
            </div>
            <p className="mt-4 text-xs text-[var(--subtext)]">Tiền đang chờ Admin kiểm tra và chuyển khoản</p>
          </div>

          {/* Card 3: Tài khoản ngân hàng */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--subtext)]">Tài khoản nhận tiền</span>
                <button
                  onClick={() => setBankModalOpen(true)}
                  className="text-xs font-bold text-[var(--primary)] hover:underline"
                >
                  {wallet.bank_account_number ? "Thay đổi" : "Cài đặt ngay"}
                </button>
              </div>
              {wallet.bank_account_number ? (
                <div className="mt-2">
                  <div className="text-base font-bold text-[var(--foreground)]">{wallet.bank_name}</div>
                  <div className="text-sm font-mono text-[var(--subtext)]">{wallet.bank_account_number}</div>
                  <div className="text-xs uppercase font-medium text-[var(--subtext)] mt-0.5">{wallet.bank_account_holder}</div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-[var(--warning)]">Chưa liên kết ngân hàng nhận tiền</p>
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--subtext)]">Tài khoản chính chủ nhận chuyển khoản</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border)] flex gap-4">
        <button
          onClick={() => setActiveTab("transactions")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "transactions"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          }`}
        >
          Lịch sử biến động số dư ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab("withdrawals")}
          className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === "withdrawals"
              ? "border-[var(--primary)] text-[var(--primary)]"
              : "border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          }`}
        >
          Lệnh rút tiền ({withdrawals.length})
        </button>
      </div>

      {/* Tab 1: Transactions Ledger */}
      {activeTab === "transactions" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-8">
              <EmptyState title="Chưa có giao dịch" description="Ví của bạn chưa ghi nhận biến động số dư nào." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--card-muted)] border-b border-[var(--border)] text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-5 py-3.5">Loại giao dịch</th>
                    <th className="px-5 py-3.5">Biến động</th>
                    <th className="px-5 py-3.5">Số dư sau GD</th>
                    <th className="px-5 py-3.5">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {transactions.map((tx) => {
                    const isPlus = tx.type === "SETTLEMENT" || tx.type === "WITHDRAWAL_REJECTED";
                    return (
                      <tr key={tx.transaction_id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--subtext)]">
                          {new Date(tx.created_at).toLocaleString("vi-VN")}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {tx.type === "SETTLEMENT" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--success-surface)] text-[var(--success)]">
                              + Quyết toán đơn
                            </span>
                          )}
                          {tx.type === "WITHDRAWAL_HOLD" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--warning-surface)] text-[var(--warning)]">
                              - Lệnh rút tiền
                            </span>
                          )}
                          {tx.type === "WITHDRAWAL_SUCCESS" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--info-surface)] text-[var(--info)]">
                              Rút tiền thành công
                            </span>
                          )}
                          {tx.type === "WITHDRAWAL_REJECTED" && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[var(--danger-surface)] text-[var(--danger)]">
                              + Hoàn tiền hủy rút
                            </span>
                          )}
                        </td>
                        <td className={`px-5 py-4 whitespace-nowrap font-bold ${isPlus ? "text-[var(--success)]" : "text-[var(--foreground)]"}`}>
                          {isPlus ? "+" : "-"}{moneyAdapter.formatVND(tx.amount)}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs font-medium text-[var(--subtext)]">
                          {moneyAdapter.formatVND(tx.balance_after)}
                        </td>
                        <td className="px-5 py-4 text-xs text-[var(--subtext)] max-w-xs truncate">
                          {tx.description}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Withdrawals List */}
      {activeTab === "withdrawals" && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm overflow-hidden">
          {withdrawals.length === 0 ? (
            <div className="p-8">
              <EmptyState title="Chưa có yêu cầu rút tiền" description="Bạn chưa tạo lệnh rút tiền nào." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--card-muted)] border-b border-[var(--border)] text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Mã yêu cầu</th>
                    <th className="px-5 py-3.5">Thời gian</th>
                    <th className="px-5 py-3.5">Số tiền</th>
                    <th className="px-5 py-3.5">Ngân hàng nhận</th>
                    <th className="px-5 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5">Ghi chú Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {withdrawals.map((req) => (
                    <tr key={req.request_id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-[var(--foreground)]">
                        #{req.request_id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--subtext)]">
                        {new Date(req.created_at).toLocaleString("vi-VN")}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap font-bold text-[var(--foreground)]">
                        {moneyAdapter.formatVND(req.amount)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--subtext)]">
                        <div>{req.bank_name} - {req.bank_account_number}</div>
                        <div className="uppercase font-medium text-[11px]">{req.bank_account_holder}</div>
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
                            Bị từ chối
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-xs text-[var(--subtext)]">
                        {req.admin_note || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Modal Cài đặt Ngân hàng */}
      <Dialog
        open={bankModalOpen}
        onOpenChange={setBankModalOpen}
        title="Cài đặt tài khoản ngân hàng nhận tiền"
        description="Thông tin tài khoản để Sàn chuyển khoản mỗi khi bạn thực hiện rút tiền."
      >
        <form onSubmit={handleSaveBank} className="space-y-4">
          <FormField id="bank_name" label="Tên ngân hàng">
            <TextInput
              id="bank_name"
              placeholder="Ví dụ: MBBank, Vietcombank, TPBank"
              value={bankForm.bank_name}
              onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
              required
            />
          </FormField>
          <FormField id="bank_account_number" label="Số tài khoản">
            <TextInput
              id="bank_account_number"
              placeholder="Ví dụ: 0987654321"
              value={bankForm.bank_account_number}
              onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
              required
            />
          </FormField>
          <FormField id="bank_account_holder" label="Tên chủ tài khoản">
            <TextInput
              id="bank_account_holder"
              placeholder="NGUYEN VAN A (Viết hoa không dấu)"
              value={bankForm.bank_account_holder}
              onChange={(e) => setBankForm({ ...bankForm, bank_account_holder: e.target.value.toUpperCase() })}
              required
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setBankModalOpen(false)} type="button">Hủy</Button>
            <Button variant="primary" type="submit" disabled={savingBank}>
              {savingBank ? "Đang lưu..." : "Lưu thông tin"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Modal Rút tiền */}
      <Dialog
        open={withdrawModalOpen}
        onOpenChange={setWithdrawModalOpen}
        title="Yêu cầu rút tiền về tài khoản"
        description={`Số dư khả dụng: ${moneyAdapter.formatVND(wallet?.balance || "0")}. Tối thiểu 50.000 VNĐ.`}
      >
        <form onSubmit={handleRequestWithdraw} className="space-y-4">
          <FormField id="withdraw_amount" label="Số tiền cần rút (VNĐ)">
            <TextInput
              id="withdraw_amount"
              type="number"
              min={50000}
              max={availableBalanceNum}
              placeholder="Ví dụ: 100000"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              required
            />
          </FormField>
          {wallet && wallet.bank_account_number && (
            <div className="rounded-xl bg-[var(--card-muted)] p-3 text-xs text-[var(--subtext)]">
              Tiền sẽ được chuyển đến: <strong className="text-[var(--foreground)]">{wallet.bank_name} - {wallet.bank_account_number}</strong> ({wallet.bank_account_holder})
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setWithdrawModalOpen(false)} type="button">Hủy</Button>
            <Button
              variant="primary"
              type="submit"
              disabled={requestingWithdraw || !withdrawAmount || Number(withdrawAmount) < 50000 || Number(withdrawAmount) > availableBalanceNum}
            >
              {requestingWithdraw ? "Đang gửi..." : "Gửi yêu cầu rút tiền"}
            </Button>
          </div>
        </form>
      </Dialog>
    </main>
  );
}
