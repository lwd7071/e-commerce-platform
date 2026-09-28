"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormField, TextArea } from "@/components/ui/form-controls";
import { Icon } from "@/components/ui/icon";
import { repositories } from "@/lib/repositories/repository-factory";
import { PREDEFINED_CANCEL_REASONS, type WireOrder } from "./orders.types";

interface CancelOrderDialogProps {
  order: WireOrder | null;
  onClose: () => void;
  onSuccess: (updatedOrder: WireOrder) => void;
  onConflictRefresh?: () => void;
}

export function CancelOrderDialog({
  order,
  onClose,
  onSuccess,
  onConflictRefresh,
}: CancelOrderDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>(PREDEFINED_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!order) return null;

  const handleSubmit = async () => {
    setError(null);
    const finalReason =
      selectedReason === "Lý do khác" ? customReason.trim() : selectedReason.trim();

    if (!finalReason) {
      setError("Vui lòng cung cấp lý do hủy đơn hàng.");
      return;
    }

    setIsSubmitting(true);
    try {
      const orderRepo = repositories.order();
      const updated = await orderRepo.cancelOrder(order.id, finalReason);
      onSuccess(updated);
      onClose();
    } catch (err: unknown) {
      // Check 409 Conflict or ORDER_CANCELLATION_NOT_ALLOWED
      const status = (err as { status?: number; code?: string })?.status;
      const code = (err as { status?: number; code?: string })?.code;
      if (status === 409 || code === "ORDER_CANCELLATION_NOT_ALLOWED" || code === "ORDER_INVALID_TRANSITION") {
        setError("Đơn hàng này đã được người bán cập nhật hoặc không thể hủy vào thời điểm này. Đang làm mới danh sách...");
        setTimeout(() => {
          onConflictRefresh?.();
          onClose();
        }, 1500);
      } else {
        const message = err instanceof Error ? err.message : "Không thể hủy đơn hàng lúc này. Vui lòng thử lại sau.";
        setError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(order)}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
      title="Hủy đơn hàng"
      description={`Mã đơn hàng: ${order.order_code || order.id}`}
      footer={
        <div className="flex justify-end gap-3 w-full">
          <Button variant="ghost" disabled={isSubmitting} onClick={onClose}>
            Giữ lại đơn hàng
          </Button>
          <Button variant="danger" loading={isSubmitting} onClick={handleSubmit}>
            Xác nhận hủy đơn
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="notice notice--warning" role="alert">
            <Icon name="warning" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        <fieldset className="space-y-2.5">
          <legend className="text-xs font-semibold text-[var(--foreground)] mb-2">
            Vui lòng chọn lý do hủy đơn hàng (bắt buộc):
          </legend>
          {PREDEFINED_CANCEL_REASONS.map((reason) => (
            <label
              key={reason}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                selectedReason === reason
                  ? "border-[var(--primary-active)] bg-[var(--primary-surface)] text-[var(--foreground)] font-medium"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--card-muted)] text-[var(--foreground)]"
              }`}
            >
              <input
                type="radio"
                name="cancel_reason"
                value={reason}
                checked={selectedReason === reason}
                onChange={() => {
                  setSelectedReason(reason);
                  setError(null);
                }}
                className="accent-[var(--primary-active)]"
              />
              <span>{reason}</span>
            </label>
          ))}
        </fieldset>

        {selectedReason === "Lý do khác" && (
          <FormField
            id="cancel-custom-reason"
            label="Chi tiết lý do khác"
            required
            helpText="Nhập thêm thông tin để Dino ghi nhận lý do hủy đơn của bạn."
            error={error && !customReason.trim() ? "Vui lòng nhập lý do cụ thể." : undefined}
          >
            <TextArea
              id="cancel-custom-reason"
              placeholder="Nhập lý do cụ thể..."
              rows={3}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
            />
          </FormField>
        )}

        <p className="text-xs text-[var(--subtext)]">
          Lưu ý: Sau khi xác nhận hủy, số lượng tồn kho sản phẩm sẽ được tự động hoàn lại cho người bán. Nếu bạn đã thanh toán qua thẻ, số tiền sẽ được hoàn trả theo quy định.
        </p>
      </div>
    </Dialog>
  );
}
