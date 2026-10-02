"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { FormField, SelectInput, TextArea, TextInput } from "@/components/ui/form-controls";
import { AdminHeaderNav } from "./admin-header-nav";

type Campaign = { campaign_id: string; audience_role: "BUYER" | "SELLER"; title: string; content: string; status: "PENDING" | "PROCESSING" | "COMPLETED"; recipient_count: number; delivered_count: number; created_at: string };
type Draft = { audience_role: "BUYER" | "SELLER"; title: string; content: string; reason: string };
const newKey = () => globalThis.crypto?.randomUUID?.() ?? `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function AdminCampaignsScreen() {
  const [draft, setDraft] = useState<Draft>({ audience_role: "BUYER", title: "", content: "", reason: "" });
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const idempotencyKey = useRef(newKey());

  useEffect(() => {
    let active = true;
    void apiClient.get<{ recipient_count: number }>("/admin/notification-campaigns/preview", { params: { audience_role: draft.audience_role } })
      .then(result => { if (active) setPreviewCount(result.recipient_count); })
      .catch(() => { if (active) setPreviewCount(null); });
    return () => { active = false; };
  }, [draft.audience_role]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const created = await apiClient.post<Campaign>("/admin/notification-campaigns", draft, { headers: { "Idempotency-Key": idempotencyKey.current } });
      setCampaign(created);
      idempotencyKey.current = newKey();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Gửi chiến dịch thất bại."); }
    finally { setSubmitting(false); }
  };

  const refresh = async () => {
    if (!campaign) return;
    setRefreshing(true); setError(null);
    try { setCampaign(await apiClient.get<Campaign>(`/admin/notification-campaigns/${campaign.campaign_id}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được tiến độ."); }
    finally { setRefreshing(false); }
  };

  return <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header>
      <AdminHeaderNav currentModule="Chiến dịch thông báo" />
      <h1 className="mt-1 text-2xl font-bold">Thông báo theo nhóm</h1>
      <p className="mt-1 text-sm text-[var(--subtext)]">Chọn một nhóm người nhận. Hệ thống lưu danh sách nhận tại thời điểm tạo và gửi lại an toàn khi cần.</p>
    </header>
    <form className="surface-card grid gap-4 p-5" onSubmit={submit}>
      <FormField id="campaign-audience" label="Nhóm nhận" required><SelectInput id="campaign-audience" value={draft.audience_role} onChange={event => setDraft({ ...draft, audience_role: event.target.value as Draft["audience_role"] })}><option value="BUYER">Người mua</option><option value="SELLER">Người bán</option></SelectInput></FormField>
      <FormField id="campaign-title" label="Tiêu đề" required><TextInput id="campaign-title" value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={200} required /></FormField>
      <FormField id="campaign-content" label="Nội dung" required><TextArea id="campaign-content" value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} rows={5} required /></FormField>
      <FormField id="campaign-reason" label="Lý do gửi" required><TextInput id="campaign-reason" value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} required /></FormField>
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={submitting}>{submitting ? "Đang tạo…" : "Tạo và gửi chiến dịch"}</Button><span className="text-xs text-[var(--subtext)]">{previewCount === null ? "Đang tính người nhận…" : `Dự kiến ${previewCount} người nhận trong nhóm này.`}</span></div>
      {error && <p role="alert" className="text-sm text-[var(--danger)]">{error}</p>}
    </form>
    {campaign && <section className="surface-card space-y-3 p-5" aria-label="Tiến độ chiến dịch"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{campaign.title}</h2><p className="text-sm text-[var(--subtext)]">Nhóm: {campaign.audience_role === "BUYER" ? "Người mua" : "Người bán"} · {campaign.status === "COMPLETED" ? "Hoàn tất" : campaign.status === "PROCESSING" ? "Đang gửi" : "Đang chờ"}</p></div><Button variant="secondary" disabled={refreshing} onClick={() => void refresh()}>{refreshing ? "Đang tải…" : "Cập nhật tiến độ"}</Button></div><p className="text-sm tabular-nums">{campaign.delivered_count} / {campaign.recipient_count} đã gửi</p><progress className="w-full" max={Math.max(campaign.recipient_count, 1)} value={campaign.delivered_count} aria-label="Tiến độ gửi thông báo" /></section>}
  </main>;
}
