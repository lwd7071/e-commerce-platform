"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProtectedPage } from "@/components/navigation/protected-page";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormField, TextArea } from "@/components/ui/form-controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/data-states";
import type { ModerationReview } from "./admin.types";
import { adminRepository } from "./admin.repository";
import { AdminHeaderNav } from "./admin-header-nav";

export function AdminReviewsScreen() {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [status, setStatus] = useState<"ALL" | "VISIBLE" | "HIDDEN">("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<ModerationReview | null>(null);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await adminRepository.getModerationReviews());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải đánh giá.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    adminRepository.getModerationReviews().then((result) => {
      if (!ignore) setReviews(result);
    }).catch((cause: unknown) => {
      if (!ignore) setError(cause instanceof Error ? cause.message : "Không thể tải đánh giá.");
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => { ignore = true; };
  }, []);

  const visibleReviews = useMemo(() => reviews.filter((review) => {
    const matchesStatus = status === "ALL" || review.status === status;
    const query = search.trim().toLocaleLowerCase("vi");
    return matchesStatus && (!query || review.productName.toLocaleLowerCase("vi").includes(query) || (review.content ?? "").toLocaleLowerCase("vi").includes(query));
  }), [reviews, search, status]);

  const submitModeration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!target) return;
    if (!reason.trim()) {
      setFormError("Nhập lý do kiểm duyệt để tiếp tục.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const updated = await adminRepository.moderateReview(target.id, target.status === "VISIBLE" ? "HIDDEN" : "VISIBLE", reason.trim());
      setReviews((current) => current.map((review) => review.id === updated.id ? updated : review));
      setTarget(null);
      setReason("");
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Không thể cập nhật trạng thái đánh giá.");
    } finally {
      setSubmitting(false);
    }
  };

  return <ProtectedPage allowedRoles={["ADMIN"]}>
    <main className="max-w-6xl mx-auto space-y-6 pb-20">
      <header className="page-heading">
        <AdminHeaderNav currentModule="Kiểm duyệt đánh giá" />
        <h1 className="page-title mt-1">Kiểm duyệt đánh giá</h1>
        <p className="page-description">Ẩn hoặc khôi phục đánh giá với lý do được ghi vào lịch sử quản trị.</p>
      </header>

      <section className="surface-card p-4 sm:p-5 space-y-4" aria-label="Bộ lọc đánh giá">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3">
          <label className="text-xs font-semibold text-[var(--subtext)]">Tìm nội dung hoặc sản phẩm
            <input className="form-input mt-1 w-full" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập từ khóa" />
          </label>
          <label className="text-xs font-semibold text-[var(--subtext)]">Trạng thái
            <select className="form-input mt-1 w-full" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              <option value="ALL">Tất cả</option><option value="VISIBLE">Đang hiển thị</option><option value="HIDDEN">Đã ẩn</option>
            </select>
          </label>
        </div>
      </section>

      {loading ? <div className="space-y-3" aria-busy="true"><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>
        : error ? <ErrorState title="Không tải được đánh giá" description={error} onRetry={() => void load()} />
          : visibleReviews.length === 0 ? <EmptyState icon="info" title="Không có đánh giá phù hợp" description="Thử đổi bộ lọc hoặc từ khóa tìm kiếm." />
            : <section className="surface-card overflow-x-auto" aria-label="Danh sách đánh giá">
              <table className="w-full min-w-[700px] text-sm text-left">
                <thead><tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs text-[var(--subtext)]"><th className="p-3">Sản phẩm</th><th className="p-3">Đánh giá</th><th className="p-3">Nội dung</th><th className="p-3">Trạng thái</th><th className="p-3 text-right">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-[var(--border)]">{visibleReviews.map((review) => <tr key={review.id}>
                  <td className="p-3 font-medium">{review.productName}<span className="block text-[11px] text-[var(--subtext)]">{review.createdAt.slice(0, 10)}</span></td>
                  <td className="p-3">{review.rating} / 5</td>
                  <td className="p-3 max-w-md whitespace-normal">{review.content || "(Không có nội dung)"}</td>
                  <td className="p-3">{review.status === "VISIBLE" ? "Đang hiển thị" : "Đã ẩn"}</td>
                  <td className="p-3 text-right"><Button variant={review.status === "VISIBLE" ? "danger" : "secondary"} onClick={() => { setTarget(review); setReason(""); setFormError(null); }}>{review.status === "VISIBLE" ? "Ẩn đánh giá" : "Khôi phục"}</Button></td>
                </tr>)}</tbody>
              </table>
            </section>}

      <Dialog open={Boolean(target)} onOpenChange={(open) => { if (!open && !submitting) setTarget(null); }} title={target?.status === "VISIBLE" ? "Ẩn đánh giá" : "Khôi phục đánh giá"} description="Lý do được lưu cùng thao tác kiểm duyệt." footer={<div className="flex justify-end gap-2"><Button variant="ghost" disabled={submitting} onClick={() => setTarget(null)}>Hủy</Button><Button variant="primary" loading={submitting} onClick={() => document.getElementById("review-moderation-reason")?.closest("form")?.requestSubmit()}>{target?.status === "VISIBLE" ? "Ẩn đánh giá" : "Khôi phục"}</Button></div>}>
        <form onSubmit={submitModeration} className="space-y-3">
          {formError && <p role="alert" className="notice notice--warning">{formError}</p>}
          <FormField id="review-moderation-reason" label="Lý do kiểm duyệt" required>
            <TextArea id="review-moderation-reason" value={reason} onChange={(event) => { setReason(event.target.value); setFormError(null); }} rows={3} autoFocus />
          </FormField>
        </form>
      </Dialog>
    </main>
  </ProtectedPage>;
}
