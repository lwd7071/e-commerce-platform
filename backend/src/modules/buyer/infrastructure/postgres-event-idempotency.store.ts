import type { IEventIdempotencyStore } from '../ports/event-idempotency.port';
import type { IDbClient } from './db-client';

/**
 * PostgresEventIdempotencyStore — Adapter lưu trữ và kiểm tra claim bền vững qua PostgreSQL.
 *
 * KIẾN TRÚC PHÒNG VỆ 2 TẦNG (TWO-TIER DEFENSE):
 * - Tier 1 (Early-exit filter): tryClaim() thực hiện tra cứu nhanh trong CSDL
 *   (`SELECT 1 FROM notifications WHERE event_id = $1 LIMIT 1`) để loại bỏ sớm các event
 *   đã được xử lý hoặc replay từ message broker, tránh lãng phí tài nguyên CPU/IO truy vấn order.
 * - Tier 2 (Atomic ground truth): Chốt chặn nguyên tử thật sự nằm ở câu lệnh
 *   `INSERT INTO notifications (...) ON CONFLICT (event_id) WHERE event_id IS NOT NULL DO NOTHING`
 *   tại PostgresNotificationRepository. Nếu 2 worker cùng vượt qua Tier 1 tại cùng một thời điểm,
 *   unique index ở CSDL bảo đảm duy nhất 1 worker ghi thành công.
 *
 * RÀNG BUỘC NGỮ NGHĨA CỦA release():
 * - release() là một no-op an toàn có chủ đích.
 * - Trong mô hình gắn liền với bản ghi notifications.event_id, trạng thái claim không dùng lock/lease
 *   tạm thời trong bảng riêng. Nếu tiến trình bị crash, timeout hoặc gặp exception trước khi
 *   commit INSERT notification, CSDL chưa tồn tại bản ghi rác nào.
 * - Do đó, không cần dọn dẹp lock. Khi tiến trình restart hoặc broker replay event, tryClaim()
 *   sẽ tiếp tục trả về true, bảo đảm tính chịu lỗi (crash resilience) và không bao giờ nuốt chửng event.
 */
export class PostgresEventIdempotencyStore implements IEventIdempotencyStore {
  constructor(private readonly db: IDbClient) {}

  async tryClaim(eventId: string): Promise<boolean> {
    const sql = `SELECT 1 FROM notifications WHERE event_id = $1 LIMIT 1`;
    const result = await this.db.query(sql, [eventId]);
    if (result.rows && result.rows.length > 0) {
      return false; // Đã tồn tại notification cho event này trong CSDL
    }
    return true; // Chưa có trong CSDL, cho phép worker tiếp tục xử lý
  }

  async release(_eventId: string): Promise<void> {
    // No-op có chủ đích: trạng thái xác định bởi bản ghi bền vững notifications.
    // Không giữ lock tạm thời nên không cần thu hồi slot khi có lỗi hoặc crash.
  }
}
