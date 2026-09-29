"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { repositories } from "../../lib/repositories/repository-factory";
import { type AdminUserItem } from "../../lib/repositories/types";
import { Button } from "../../components/ui/button";
import { TextInput, TextArea } from "../../components/ui/form-controls";
import { Dialog } from "../../components/ui/dialog";
import { Skeleton, ErrorState, EmptyState } from "../../components/ui/data-states";
import { useToast } from "../../components/ui/toast";

export function AdminScreen() {
  const showToast = useToast();

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Lock user modal state
  const [targetUser, setTargetUser] = useState<AdminUserItem | null>(null);
  const [lockReason, setLockReason] = useState("");
  const [isLocking, setIsLocking] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await repositories.admin().getUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Tải danh sách người dùng thất bại");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    repositories
      .admin()
      .getUsers()
      .then((data) => {
        if (!ignore) {
          setUsers(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Tải danh sách người dùng thất bại");
          setIsLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  const handleOpenLockDialog = (user: AdminUserItem) => {
    setTargetUser(user);
    setLockReason("");
  };

  const handleConfirmLock = async () => {
    if (!targetUser) return;
    if (!lockReason.trim()) {
      showToast("Vui lòng nhập lý do khóa tài khoản", "error");
      return;
    }

    setIsLocking(true);
    try {
      await repositories.admin().lockUser({
        user_id: targetUser.id,
        reason: lockReason.trim(),
      });
      showToast(`Đã khóa tài khoản ${targetUser.email}`, "success");
      setTargetUser(null);
      fetchUsers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Khóa tài khoản thất bại", "error");
    } finally {
      setIsLocking(false);
    }
  };

  const handleUnlockUser = async (user: AdminUserItem) => {
    try {
      await repositories.admin().unlockUser(user.id);
      showToast(`Đã mở khóa tài khoản ${user.email}`, "success");
      fetchUsers();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Mở khóa tài khoản thất bại", "error");
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
    if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Sub-navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="eyebrow">Hệ thống quản trị</p>
          <h1 className="page-title">Quản Lý Người Dùng & Kiểm Duyệt</h1>
          <p className="page-description">
            Kiểm soát tài khoản người mua, người bán và xử lý các trường hợp vi phạm quy định sàn.
          </p>
        </div>
      </div>

      <nav aria-label="Điều hướng quản trị" className="border-b border-[var(--border)]">
        <div className="flex gap-6 text-sm font-semibold">
          <Link
            href="/admin"
            className="pb-3 border-b-2 border-[var(--primary-active)] text-[var(--primary-active)]"
            aria-current="page"
          >
            Danh sách người dùng
          </Link>
          <Link
            href="/admin/categories"
            className="pb-3 border-b-2 border-transparent text-[var(--subtext)] hover:text-[var(--foreground)]"
          >
            Quản lý danh mục
          </Link>
        </div>
      </nav>

      {/* Controls: Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="w-full sm:w-72">
            <TextInput
              id="admin-search-users"
              placeholder="Tìm theo email, họ tên, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="role-filter" className="font-semibold text-[var(--subtext)]">
              Vai trò:
            </label>
            <select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="BUYER">Người mua (BUYER)</option>
              <option value="SELLER">Người bán (SELLER)</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label htmlFor="status-filter" className="font-semibold text-[var(--subtext)]">
              Trạng thái:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--foreground)]"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động (ACTIVE)</option>
              <option value="LOCKED">Bị khóa (LOCKED)</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-[var(--subtext)]">
          Tổng cộng: <strong className="text-[var(--foreground)]">{filteredUsers.length}</strong> tài khoản
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="space-y-3 surface-card p-6">
          <Skeleton height={32} className="w-1/4" />
          <Skeleton height={44} className="w-full" />
          <Skeleton height={44} className="w-full" />
          <Skeleton height={44} className="w-full" />
        </div>
      ) : error ? (
        <ErrorState
          title="Không thể tải danh sách người dùng"
          description={error}
          onRetry={fetchUsers}
        />
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon="bag"
          title="Không tìm thấy người dùng phù hợp"
          description="Hãy thử thay đổi điều kiện tìm kiếm hoặc bộ lọc trạng thái."
        />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--card-muted)] text-xs font-bold text-[var(--subtext)]">
                  <th className="py-3.5 px-4">Người dùng</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4 text-center">Vai trò</th>
                  <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  <th className="py-3.5 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredUsers.map((u) => {
                  const isLocked = u.status === "LOCKED";
                  const isAdmin = u.role === "ADMIN";

                  return (
                    <tr key={u.id} className="hover:bg-[var(--card-muted)]/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--foreground)]">{u.full_name}</div>
                        <div className="text-xs text-[var(--subtext)] font-mono">ID: {u.id}</div>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--foreground)] font-mono text-xs">
                        {u.email}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            isLocked
                              ? "bg-[var(--danger-surface)] text-[var(--danger-text)] border-[var(--danger-border)]"
                              : "bg-[var(--success-surface)] text-[var(--success-text)] border-[var(--border)]"
                          }`}
                        >
                          {isLocked ? "Bị khóa" : "Hoạt động"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {!isAdmin ? (
                          isLocked ? (
                            <Button
                              variant="secondary"
                              onClick={() => handleUnlockUser(u)}
                              className="h-8 px-3 text-xs"
                            >
                              Mở khóa
                            </Button>
                          ) : (
                            <Button
                              variant="danger"
                              onClick={() => handleOpenLockDialog(u)}
                              className="h-8 px-3 text-xs"
                            >
                              Khóa tài khoản
                            </Button>
                          )
                        ) : (
                          <span className="text-xs text-[var(--subtext)] italic">Quản trị viên</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog Khóa Tài Khoản */}
      {targetUser && (
        <Dialog
          open
          onOpenChange={(open) => !open && setTargetUser(null)}
          title="Xác nhận khóa tài khoản người dùng"
          description={`Tài khoản: ${targetUser.email} (${targetUser.full_name})`}
          footer={
            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setTargetUser(null)} disabled={isLocking}>
                Hủy bỏ
              </Button>
              <Button variant="danger" onClick={handleConfirmLock} disabled={isLocking}>
                {isLocking ? "Đang xử lý..." : "Xác nhận khóa"}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-[var(--foreground)]">
              Sau khi khóa, người dùng sẽ không thể đăng nhập hoặc thực hiện các giao dịch mua bán trên hệ thống.
            </p>
            <div>
              <label htmlFor="lock-reason" className="block text-xs font-bold text-[var(--foreground)] mb-1">
                Lý do khóa tài khoản <span className="text-[var(--danger-text)]">*</span>
              </label>
              <TextArea
                id="lock-reason"
                rows={3}
                placeholder="Ví dụ: Đăng bán hàng giả mạo, spam đơn ảo nhiều lần..."
                value={lockReason}
                onChange={(e) => setLockReason(e.target.value)}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
