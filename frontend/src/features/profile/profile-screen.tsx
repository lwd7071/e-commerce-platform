"use client";

import { useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { Icon } from "../../components/ui/icon";
import { TextInput } from "../../components/ui/form-controls";

export type AuthProfileSnapshot = { email?: string | null; fullName?: string | null; phone?: string | null };

export function ProfilePageContent() {
  const { user } = useAuth();
  const profile = user ? { email: user.email, fullName: user.fullName, phone: null } : null;
  return <ProtectedPage><ProfileScreen profile={profile} /></ProtectedPage>;
}

export function ProfileScreen({ profile }: { profile: AuthProfileSnapshot | null }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const displayName = profile?.fullName?.trim() || "Tài khoản Dino";
  const initials = displayName === "Tài khoản Dino" ? "D" : displayName.slice(0, 1).toLocaleUpperCase("vi-VN");

  return (
    <>
      <header className="page-heading">
        <div><p className="eyebrow">Tài khoản của bạn</p><h1 className="page-title">Hồ sơ cá nhân</h1><p className="page-description">Thông tin đăng nhập hiện chỉ được đọc; việc cập nhật hồ sơ sẽ mở khi API được bổ sung.</p></div>
      </header>
      {!profile && <div className="notice notice--warning" role="status"><Icon name="info" /><span>Chưa có phiên đăng nhập để đọc thông tin tài khoản. Đăng nhập để xem metadata hiện có.</span><Link href="/login">Đăng nhập</Link></div>}
      <div className="profile-grid">
        <section className="profile-summary surface-card" aria-label="Ảnh và tên tài khoản">
          <div className="avatar" role="img" aria-label={`Ảnh đại diện mặc định của ${displayName}`}>{initials}</div>
          <p className="profile-summary__name">{displayName}</p>
          <p className="profile-summary__email">{profile?.email || "Email chưa được cung cấp"}</p>
          <div className="avatar-picker">
            <input ref={fileRef} className="file-input-hidden" id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" disabled aria-describedby="avatar-unavailable" />
            <Button variant="secondary" disabled leadingIcon={<Icon name="user" />} onClick={() => fileRef.current?.click()}>Đổi ảnh đại diện</Button>
            <span className="field-help" id="avatar-unavailable">Tạm khóa đến khi backend có hợp đồng upload media (GAP-09). Ảnh đại diện hiện chưa được lưu.</span>
          </div>
        </section>
        <section className="profile-form surface-card" aria-labelledby="profile-info-title">
          <div><h2 className="section-title" id="profile-info-title">Thông tin cơ bản</h2><p className="section-subtitle">Metadata chỉ để hiển thị, chưa phải hồ sơ nghiệp vụ chính thức.</p></div>
          <label className="field-stack"><span className="field-label">Họ và tên</span><TextInput id="profile-name" value={profile?.fullName || ""} placeholder="Chưa có dữ liệu" readOnly /></label>
          <div className="profile-form__grid">
            <label className="field-stack"><span className="field-label">Email</span><TextInput id="profile-email" type="email" value={profile?.email || ""} placeholder="Chưa có dữ liệu" readOnly /></label>
            <label className="field-stack"><span className="field-label">Số điện thoại</span><TextInput id="profile-phone" value={profile?.phone || ""} placeholder="Chưa có dữ liệu" readOnly /></label>
          </div>
          <div className="notice"><Icon name="info" /><span>Chỉnh sửa hồ sơ và lưu thay đổi sẽ được bật sau khi API profile (P-601/GAP-07) có contract và kiểm thử runtime.</span></div>
          <div><Button disabled title="API cập nhật hồ sơ chưa sẵn sàng">Lưu thay đổi</Button></div>
        </section>
      </div>
    </>
  );
}
