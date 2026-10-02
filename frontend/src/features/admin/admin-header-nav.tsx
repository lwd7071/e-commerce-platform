"use client";

import React from "react";
import Link from "next/link";

interface AdminHeaderNavProps {
  currentModule: string;
}

export function AdminHeaderNav({ currentModule }: AdminHeaderNavProps) {
  return (
    <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold">
      <Link
        href="/"
        className="text-[var(--subtext)] hover:text-[var(--primary-active)] flex items-center gap-1 transition-colors"
        title="Quay về trang chủ sàn"
      >
        <span>🏠 Trang chủ</span>
      </Link>
      <span className="text-[var(--subtext)]">/</span>
      <Link
        href="/admin"
        className="text-[var(--subtext)] hover:text-[var(--primary-active)] flex items-center gap-1 transition-colors"
        title="Quay lại trung tâm quản trị"
      >
        <span>Quản trị</span>
      </Link>
      <span className="text-[var(--subtext)]">•</span>
      <span className="eyebrow m-0 text-[11px] font-bold uppercase tracking-wider text-[var(--primary)]">
        {currentModule}
      </span>
    </div>
  );
}
