"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { TextInput } from "../../components/ui/form-controls";
import { useToast } from "../../components/ui/toast";
import { buyerApi } from "../../lib/api/buyer.api";
import { AddressManager } from "./address-manager";

export type AuthProfileSnapshot = { email?: string | null; fullName?: string | null; phone?: string | null; avatarUrl?: string | null };

export function ProfilePageContent() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AuthProfileSnapshot | null>(user ? { email: user.email, fullName: user.fullName, phone: null, avatarUrl: null } : null);
  useEffect(() => {
    if (!user) return;
    buyerApi.getProfile().then(value => setProfile({ email: user.email, fullName: value.full_name, phone: value.phone, avatarUrl: value.avatar_url }))
      .catch(() => setProfile(null));
  }, [user]);
  return (
    <ProtectedPage>
      <ProfileScreen key={`${user?.id ?? "guest"}:${profile?.fullName ?? ""}:${profile?.phone ?? ""}`} profile={profile} />
    </ProtectedPage>
  );
}

export function ProfileScreen({ profile }: { profile: AuthProfileSnapshot | null }) {
  const showToast = useToast();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [isSaving, setIsSaving] = useState(false);

  const displayName = fullName.trim() || profile?.fullName?.trim() || "Tài khoản Dino";
  const initials = displayName === "Tài khoản Dino" ? "D" : displayName.slice(0, 1).toLocaleUpperCase("vi-VN");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast("Vui lòng nhập họ và tên", "error");
      return;
    }

    setIsSaving(true);
    try {
      const saved = await buyerApi.updateProfile({ full_name: fullName.trim(), phone: phone.trim() || null });
      setFullName(saved.full_name || "");
      setPhone(saved.phone || "");
      showToast("Cập nhật thông tin hồ sơ thành công!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Cập nhật hồ sơ thất bại", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Tài khoản của bạn</p>
          <h1 className="page-title">Hồ sơ cá nhân</h1>
          <p className="page-description">
            Quản lý thông tin cá nhân, ảnh đại diện và địa chỉ giao hàng của bạn.
          </p>
        </div>
      </header>

      {!profile && (
        <div className="notice notice--warning" role="status">
          <Icon name="info" />
          <span>Chưa có phiên đăng nhập để đọc thông tin tài khoản. Đăng nhập để xem metadata hiện có.</span>
          <Link href="/login">Đăng nhập</Link>
        </div>
      )}

      <div className="profile-grid">
        <section className="profile-summary surface-card" aria-label="Ảnh và tên tài khoản">
          {profile?.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.avatarUrl}
              alt={`Ảnh đại diện của ${displayName}`}
              className="w-20 h-20 rounded-full object-cover border-2 border-[var(--primary)] shadow-sm"
            />
          ) : (
            <div className="avatar" role="img" aria-label={`Ảnh đại diện mặc định của ${displayName}`}>
              {initials}
            </div>
          )}

          <p className="profile-summary__name">{displayName}</p>
          <p className="profile-summary__email">{profile?.email || "Email chưa được cung cấp"}</p>

          <div className="avatar-picker">
            <Button
              variant="secondary"
              disabled
              leadingIcon={<Icon name="user" />}
              className="min-h-[44px]"
            >
              Tải ảnh đại diện (chưa hỗ trợ)
            </Button>
            <span className="field-help" id="avatar-hint">
              Tính năng tải ảnh sẽ được bổ sung sau.
            </span>
          </div>
        </section>

        <section className="profile-form surface-card" aria-labelledby="profile-info-title">
          <div>
            <h2 className="section-title" id="profile-info-title">Thông tin cơ bản</h2>
            <p className="section-subtitle">Chỉnh sửa tên hiển thị và thông tin liên hệ của bạn.</p>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <label className="field-stack">
              <span className="field-label">Họ và tên</span>
              <TextInput
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nhập họ và tên..."
              />
            </label>

            <div className="profile-form__grid">
              <label className="field-stack">
                <span className="field-label">Email (Chỉ đọc)</span>
                <TextInput
                  id="profile-email"
                  type="email"
                  value={profile?.email || ""}
                  placeholder="Chưa có dữ liệu"
                  readOnly
                />
              </label>
              <label className="field-stack">
                <span className="field-label">Số điện thoại</span>
                <TextInput
                  id="profile-phone"
                  value={phone}
                  placeholder="Chưa có số điện thoại"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>

            <div className="pt-2">
              <Button type="submit" variant="primary" disabled={isSaving} className="min-h-[44px] px-6">
                {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </section>
      </div>
      <AddressManager />
    </>
  );
}
