"use client";

import React, { useEffect, useRef, useState } from "react";
import { buyerApi, type BuyerLoyaltyInfo, type BuyerLoyaltyHistory, type LoyaltyReward } from "@/lib/api/buyer.api";
import { Button } from "@/components/ui/button";
import { moneyAdapter } from "@/lib/adapters/money.adapter";
import { TierBadge } from "@/components/ui/tier-badge";
import { Icon } from "@/components/ui/icon";

export type BuyerLoyaltyCardProps = {
  initialLoyalty?: BuyerLoyaltyInfo | null;
  initialHistory?: BuyerLoyaltyHistory | null;
  isLoading?: boolean;
};

export function BuyerLoyaltyCard({
  initialLoyalty,
  initialHistory,
  isLoading: externalLoading,
}: BuyerLoyaltyCardProps = {}) {
  const hasExternalData = initialLoyalty !== undefined;

  const [selfLoyalty, setSelfLoyalty] = useState<BuyerLoyaltyInfo | null>(null);
  const [selfHistory, setSelfHistory] = useState<BuyerLoyaltyHistory | null>(null);
  const [selfLoading, setSelfLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ source: BuyerLoyaltyInfo | null | undefined } | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [redeeming, setRedeeming] = useState(false);
  const [rewardError, setRewardError] = useState<string | null>(null);
  const redeemKey = useRef<string | null>(null);
  useEffect(() => {
    if (typeof buyerApi.getLoyaltyRewards !== 'function') return;
    let active = true;
    buyerApi.getLoyaltyRewards().then(rows => { if (active) setRewards(rows); })
      .catch(() => { if (active) setRewardError('Không tải được voucher đã đổi. Hãy tải lại trang để thử lại.'); });
    return () => { active = false; };
  }, []);
  const redeem = async () => {
    if (redeeming) return;
    setRedeeming(true); setRewardError(null);
    redeemKey.current ??= crypto.randomUUID();
    try {
      await buyerApi.redeemLoyalty(redeemKey.current);
      const [info, transactions, vouchers] = await Promise.all([buyerApi.getLoyalty(), buyerApi.getLoyaltyHistory(), buyerApi.getLoyaltyRewards()]);
      setSelfLoyalty(info); setSelfHistory(transactions); setRewards(vouchers); setFresh({ source: initialLoyalty });
      redeemKey.current = null;
    } catch (cause) { setRewardError(cause instanceof Error ? cause.message : 'Không đổi được voucher.'); }
    finally { setRedeeming(false); }
  };

  useEffect(() => {
    // Nếu dữ liệu đã được cung cấp từ tầng điều phối trang thì không fetch lại
    if (hasExternalData) return;

    let active = true;
    const fetchLoyalty = typeof buyerApi.getLoyalty === "function"
      ? buyerApi.getLoyalty().catch((e) => { console.warn("Could not load loyalty info", e); return null; })
      : Promise.resolve(null);

    const fetchHistory = typeof buyerApi.getLoyaltyHistory === "function"
      ? buyerApi.getLoyaltyHistory({ page: 1, limit: 10 }).catch((e) => { console.warn("Could not load loyalty history", e); return null; })
      : Promise.resolve(null);

    Promise.all([fetchLoyalty, fetchHistory]).then(([loyaltyRes, historyRes]) => {
      if (!active) return;
      if (loyaltyRes) setSelfLoyalty(loyaltyRes);
      if (historyRes) setSelfHistory(historyRes);
      setSelfLoading(false);
    }).catch((err: unknown) => {
      if (!active) return;
      setError(err instanceof Error ? err.message : "Không thể tải thông tin tích điểm");
      setSelfLoading(false);
    });
    return () => { active = false; };
  }, [hasExternalData]);

  const useExternal = hasExternalData && (fresh === null || fresh.source !== initialLoyalty);
  const loyalty = useExternal ? (initialLoyalty ?? null) : selfLoyalty;
  const history = useExternal ? (initialHistory ?? null) : selfHistory;
  const isLoading = hasExternalData ? Boolean(externalLoading) : selfLoading;


  if (isLoading) {
    return (
      <section className="surface-card space-y-4 p-5 sm:p-6" aria-busy="true" aria-label="Đang tải thông tin thành viên" data-testid="loyalty-card-skeleton">
        <div className="flex items-center gap-3 text-[var(--subtext)]">
          <Icon name="spinner" className="animate-spin text-[var(--primary)]" />
          <span className="text-sm font-medium">Đang tải thông tin hạng thành viên và DinoPoint…</span>
        </div>
      </section>
    );
  }

  if (error || !loyalty) {
    return null;
  }

  const spentNum = parseFloat(loyalty.total_spent) || 0;
  const thresholdNum = parseFloat(loyalty.vip_threshold) || 5000000;
  const progressPct = Math.min(100, Math.max(0, Math.floor((spentNum / thresholdNum) * 100)));
  const isVip = loyalty.tier === "VIP";

  return (
    <section className="surface-card space-y-6 p-5 sm:p-6" aria-labelledby="loyalty-title" data-testid="buyer-loyalty-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 id="loyalty-title" className="section-title">Hạng thành viên & DinoPoint</h2>
            <TierBadge tier={isVip ? "VIP" : null} />
          </div>
          <p className="section-subtitle mt-1">
            {isVip
              ? "Bạn đang là Thành viên VIP. Tận hưởng ưu đãi tích lũy x2 điểm DinoPoint trên mọi đơn hàng!"
              : "Tích lũy chi tiêu từ các đơn hàng hoàn tất để nâng hạng VIP và nhận x2 điểm thưởng."}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--card-muted)] px-4 py-2.5 rounded-xl border border-[var(--border)]" data-testid="loyalty-points-badge">
          <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Icon name="star" className="w-5 h-5 fill-amber-400 text-amber-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--subtext)] uppercase tracking-wider">Số dư DinoPoint</p>
            <p className="text-xl font-bold text-[var(--primary)]">{loyalty.loyalty_points.toLocaleString("vi-VN")} <span className="text-sm font-normal text-[var(--subtext)]">điểm</span></p>
          </div>
        </div>
      </div>

      {/* Progress towards VIP */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[var(--foreground)]">
            Tiến trình hạng VIP ({moneyAdapter.formatVND(loyalty.total_spent)} / {moneyAdapter.formatVND(loyalty.vip_threshold)})
          </span>
          <span className="font-semibold text-[var(--primary)]">
            {isVip ? "Đạt VIP" : `${progressPct}%`}
          </span>
        </div>
        <div
          className="w-full bg-[var(--card-muted)] rounded-full h-3 overflow-hidden border border-[var(--border)]"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tiến trình lên hạng VIP"
        >
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-400 to-amber-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-[var(--subtext)]">
          {isVip
            ? "Tuyệt vời! Bạn đã đạt hạng VIP cao nhất và đang hưởng hệ số tích điểm x2."
            : `Còn thiếu ${moneyAdapter.formatVND(Math.max(0, thresholdNum - spentNum))} chi tiêu hoàn tất để đạt hạng VIP.`}
        </p>
      </div>

      <section className="space-y-3" aria-label="Đổi DinoPoint">
        <h3 className="font-semibold">Đổi điểm lấy voucher</h3>
        <p className="text-sm text-[var(--subtext)]">100 DinoPoint đổi voucher giảm 10.000đ cho đơn từ 100.000đ. Dùng một lần, hạn 30 ngày, chỉ dành cho bạn.</p>
        <Button onClick={() => void redeem()} disabled={redeeming || loyalty.loyalty_points < 100}>{redeeming ? 'Đang đổi…' : 'Đổi 100 điểm lấy voucher'}</Button>
        {loyalty.loyalty_points < 0 && <p className="text-sm">Điểm đã thu hồi sau hoàn tiền. Điểm tích lũy mới sẽ bù số dư này; hiện chưa thể đổi thưởng.</p>}
        {rewardError && <p role="alert" className="text-sm text-[var(--danger)]">{rewardError}</p>}
        <ul className="space-y-2">{rewards.map(reward => <li key={reward.voucher_id} className="rounded-lg border border-[var(--border)] p-3 text-sm break-all">
          <code>{reward.code}</code> · {reward.quantity === 0 ? 'Đã sử dụng' : reward.expired ? 'Hết hạn' : 'Chưa sử dụng'} · Hạn {new Date(reward.end_at).toLocaleDateString('vi-VN')}
        </li>)}</ul>
      </section>
      {/* Points History Ledger */}
      <div className="space-y-3 pt-2">
        <h3 className="font-semibold text-base text-[var(--foreground)]">Lịch sử tích điểm gần đây</h3>
        {(!history || history.items.length === 0) ? (
          <p className="text-sm text-[var(--subtext)] italic py-2">
            Chưa có giao dịch tích điểm nào. Điểm DinoPoint sẽ tự động cộng khi bạn hoàn tất đơn hàng.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse" aria-label="Bảng lịch sử tích điểm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs font-semibold text-[var(--subtext)] uppercase">
                  <th scope="col" className="py-2 px-3">Thời gian</th>
                  <th scope="col" className="py-2 px-3">Hoạt động</th>
                  <th scope="col" className="py-2 px-3">Mã đơn hàng</th>
                  <th scope="col" className="py-2 px-3 text-right">Điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {history.items.map((item) => (
                  <tr key={item.transaction_id} className="hover:bg-[var(--card-muted)] transition-colors">
                    <td className="py-2.5 px-3 text-[var(--subtext)] whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[var(--foreground)]">
                      {item.reason === "ORDER_COMPLETED" ? "Hoàn tất đơn hàng" : item.reason === 'ORDER_REFUND' ? 'Thu hồi sau hoàn tiền' : item.reason === 'POINTS_REDEEMED' ? 'Đổi voucher' : item.reason}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-[var(--subtext)]">
                      {item.reference_order_id ? `#${item.reference_order_id.slice(0, 8)}` : "—"}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${item.points_delta < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {item.points_delta > 0 ? '+' : ''}{item.points_delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
