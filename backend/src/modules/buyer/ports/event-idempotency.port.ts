/**
 * Event Idempotency Port — Buyer Supporting Domain (Mốc T3)
 * Cung cấp giao diện atomic claim / release để chống trùng lặp xử lý domain event
 * xuyên qua nhiều workers hoặc nhiều instances phân tán.
 * Thực thi Quality Gate T3 (testing-quality-gates.md §8: Idempotency gates).
 */
export interface IEventIdempotencyStore {
  /**
   * Atomic claim: Thử giành quyền xử lý eventId một cách nguyên tử.
   * @param eventId Mã định danh duy nhất của sự kiện
   * @returns true nếu giành quyền thành công (chưa worker nào claim/xử lý),
   *          false nếu đã có worker khác claim hoặc đã hoàn thành.
   */
  tryClaim(eventId: string): Promise<boolean> | boolean;

  /**
   * Giải phóng claim khi xử lý thất bại (ví dụ: lỗi CSDL tạm thời, connection timeout),
   * cho phép lần retry/replay tiếp theo có thể claim và thực hiện lại.
   * @param eventId Mã định danh duy nhất của sự kiện
   */
  release(eventId: string): Promise<void> | void;
}

/**
 * In-memory implementation của IEventIdempotencyStore.
 * Dùng làm store mặc định, test harness, hoặc worker cục bộ.
 *
 * RÀNG BUỘC DI: Trong ứng dụng production, store phải được wire là SINGLETON
 * (một instance dùng chung cho toàn bộ tiến trình) để tránh việc mỗi service instance
 * tự tạo một store riêng dẫn đến mất trạng thái dedup.
 *
 * GHI CHÚ PHỤ THUỘC (DEP-P4-P2-01):
 * Adapter lưu trữ qua CSDL (PostgresEventIdempotencyStore) đang chờ Người 2 bàn giao
 * migration bổ sung cột event_id UNIQUE trong bảng notifications.
 */
export class InMemoryEventIdempotencyStore implements IEventIdempotencyStore {
  private readonly claimed = new Set<string>();

  tryClaim(eventId: string): boolean {
    if (this.claimed.has(eventId)) {
      return false;
    }
    this.claimed.add(eventId);
    return true;
  }

  release(eventId: string): void {
    this.claimed.delete(eventId);
  }

  clear(): void {
    this.claimed.clear();
  }
}
