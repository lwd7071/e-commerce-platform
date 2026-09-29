"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { TextInput } from "../../components/ui/form-controls";
import { useToast } from "../../components/ui/toast";
import { uploadMedia, validateMediaFile } from "../../lib/api/media.api";

export type AuthProfileSnapshot = { email?: string | null; fullName?: string | null; phone?: string | null; avatarUrl?: string | null };

export function ProfilePageContent() {
  const { user } = useAuth();
  const profile = user ? { email: user.email, fullName: user.fullName, phone: null, avatarUrl: null } : null;
  return (
    <ProtectedPage>
      <ProfileScreen profile={profile} />
    </ProtectedPage>
  );
}

export function ProfileScreen({ profile }: { profile: AuthProfileSnapshot | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const showToast = useToast();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl || null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const displayName = fullName.trim() || profile?.fullName?.trim() || "Tài khoản Dino";
  const initials = displayName === "Tài khoản Dino" ? "D" : displayName.slice(0, 1).toLocaleUpperCase("vi-VN");

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateMediaFile(file);
    if (!validation.valid) {
      showToast(validation.error || "File không hợp lệ", "error");
      return;
    }

    setIsUploading(true);
    try {
      const url = await uploadMedia(file, { folder: "avatars" });
      setAvatarUrl(url);
      showToast("Tải ảnh đại diện thành công!", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Tải ảnh đại diện thất bại", "error");
    } finally {
      setIsUploading(false);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast("Vui lòng nhập họ và tên", "error");
      return;
    }

    setIsSaving(true);
    try {
      // Simulate profile save or call API
      await new Promise((r) => setTimeout(r, 400));
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
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarUrl}
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
            <input
              ref={fileRef}
              className="hidden"
              id="avatar-file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
            />
            <Button
              variant="secondary"
              disabled={isUploading}
              leadingIcon={<Icon name="user" />}
              onClick={() => fileRef.current?.click()}
              className="min-h-[44px]"
            >
              {isUploading ? "Đang tải ảnh..." : "Đổi ảnh đại diện"}
            </Button>
            <span className="field-help" id="avatar-hint">
              Hỗ trợ ảnh JPG, PNG, WebP tối đa 5MB.
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
                  value={profile?.phone || ""}
                  placeholder="Chưa có số điện thoại"
                  readOnly
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
    </>
  );
}
