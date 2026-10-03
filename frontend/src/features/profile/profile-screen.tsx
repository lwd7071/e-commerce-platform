"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { ProtectedPage } from "../../components/navigation/protected-page";
import { Button } from "../../components/ui/button";
import { ErrorState } from "../../components/ui/data-states";
import { Icon } from "../../components/ui/icon";
import { TextInput } from "../../components/ui/form-controls";
import { useToast } from "../../components/ui/toast";
import { buyerApi } from "../../lib/api/buyer.api";
import { uploadMediaAsset } from "../../lib/api/media.api";
import { AddressManager } from "./address-manager";
import { BuyerLoyaltyCard } from "./loyalty-card";
import { profileFailureState, type ProfileRequestState, type ProfileSnapshot } from "./profile-request-state";

export type AuthProfileSnapshot = ProfileSnapshot & { avatarUrl?: string | null };

export function ProfilePageContent() {
  const { user, isLoading: authLoading, logout } = useAuth();
  const userId = user?.id;
  const userEmail = user?.email;
  const userRole = user?.role;
  const [requestState, setRequestState] = useState<ProfileRequestState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (authLoading || !userId || !userEmail || !userRole) return () => { active = false; };
    buyerApi.getProfile()
      .then((value) => {
        if (!value || (value.full_name !== null && typeof value.full_name !== "string") || (value.phone !== null && typeof value.phone !== "string")) {
          throw new Error("Phản hồi hồ sơ không hợp lệ. Vui lòng thử lại.");
        }
        if (active) setRequestState({
          status: "ready",
          profile: { email: userEmail, role: userRole, fullName: value.full_name, phone: value.phone, avatarUrl: value.avatar_url },
        });
      })
      .catch((error: unknown) => {
        if (active) setRequestState(profileFailureState(error));
      });
    return () => { active = false; };
  }, [authLoading, attempt, userEmail, userId, userRole]);

  const retry = () => {
    setRequestState({ status: "loading" });
    setAttempt((value) => value + 1);
  };
  if (authLoading) return <ProfileScreen state={{ status: "loading" }} onRetry={retry} onLogout={logout} />;
  if (!user) return <ProfileScreen state={{ status: "signed_out" }} onRetry={retry} onLogout={logout} />;
  const state = requestState.status === "ready" && requestState.profile.email !== user.email
    ? { status: "loading" as const }
    : requestState;
  return <ProtectedPage><ProfileScreen state={state} onRetry={retry} onLogout={logout} /></ProtectedPage>;
}

export function ProfileScreen({
  state,
  onRetry,
  onLogout,
}: {
  state: ProfileRequestState;
  onRetry: () => void;
  onLogout?: () => Promise<void> | void;
}) {
  if (state.status === "loading") {
    return <section className="surface-card loading-stack" aria-busy="true" aria-label="Đang tải hồ sơ"><Icon name="spinner" />Đang tải hồ sơ…</section>;
  }
  if (state.status === "signed_out") {
    return <section className="notice" role="status"><Icon name="info" /><span>Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại để xem hồ sơ.</span><Link href="/login?returnTo=%2Fprofile">Đăng nhập</Link></section>;
  }
  if (state.status === "missing") {
    return <section className="empty-state surface-card" aria-labelledby="missing-profile-title"><span className="empty-state__icon"><Icon name="user" /></span><h2 id="missing-profile-title">Chưa có hồ sơ cá nhân</h2><p>Hoàn tất thông tin cơ bản để tiếp tục sử dụng tài khoản.</p><Link className="button button--secondary" href="/complete-profile">Hoàn tất hồ sơ</Link></section>;
  }
  if (state.status === "error") {
    return <>
      <ErrorState title="Không tải được hồ sơ" description={state.message} requestId={state.requestId} onRetry={onRetry} />
      {state.code && <p className="field-help text-center">Mã lỗi: {state.code}</p>}
    </>;
  }
  return (
    <ProfileReadyScreen
      key={`${state.profile.email}:${state.profile.fullName ?? ""}:${state.profile.phone ?? ""}`}
      profile={state.profile}
      onLogout={onLogout}
    />
  );
}

function ProfileReadyScreen({
  profile,
  onLogout,
}: {
  profile: AuthProfileSnapshot;
  onLogout?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const showToast = useToast();

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  const displayName = fullName.trim() || profile?.fullName?.trim() || "Tài khoản Dino";
  const initials = displayName === "Tài khoản Dino" ? "D" : displayName.slice(0, 1).toLocaleUpperCase("vi-VN");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      }
      showToast("Đã đăng xuất thành công", "success");
      router.push("/login");
    } catch {
      showToast("Đăng xuất thất bại", "error");
    } finally {
      setIsLoggingOut(false);
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

  const handleAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const uploaded = await uploadMediaAsset(file, { purpose: "avatar_image" });
      if (!uploaded.mediaId) throw new Error("Máy chủ chưa xác nhận ảnh đại diện. Vui lòng thử lại.");
      const saved = await buyerApi.updateAvatar(uploaded.mediaId);
      setAvatarUrl(saved.avatar_url);
      showToast("Đã cập nhật ảnh đại diện", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Tải ảnh đại diện thất bại", "error");
    } finally {
      setIsUploadingAvatar(false);
      input.value = "";
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
            <Button
              variant="secondary"
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => avatarInput.current?.click()}
              leadingIcon={<Icon name="user" />}
              className="min-h-[44px]"
            >
              {isUploadingAvatar ? "Đang tải ảnh…" : avatarUrl ? "Đổi ảnh đại diện" : "Tải ảnh đại diện"}
            </Button>
            <input ref={avatarInput} data-testid="profile-avatar-upload" className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="avatar-hint" onChange={handleAvatarSelected} />
            <span className="field-help" id="avatar-hint">JPG, PNG hoặc WebP; tối đa 5 MB.</span>
          </div>

          <div className="w-full pt-4 mt-4 border-t border-[var(--border)]">
            <Button
              variant="danger"
              type="button"
              disabled={isLoggingOut}
              loading={isLoggingOut}
              onClick={handleLogout}
              leadingIcon={<Icon name="logout" />}
              className="w-full min-h-[44px]"
            >
              Đăng xuất
            </Button>
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
                <span className="field-label">Vai trò (Chỉ đọc)</span>
                <TextInput id="profile-role" value={profile.role} readOnly />
              </label>
            </div>

            <div className="profile-form__grid">
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
      {profile.role === "BUYER" && (
        <div className="space-y-6 mt-6">
          <BuyerLoyaltyCard />
          <AddressManager />
        </div>
      )}
    </>
  );
}
