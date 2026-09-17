import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markNotificationAsRead } from '../../../src/modules/buyer/domain/notification';
import type { Notification } from '../../../src/modules/buyer/domain/types';
import { mockBuyerId } from './fixtures';

describe('Notification Domain Tests (RB-LTT07)', () => {

  const unreadNotification: Notification = {
    notificationId: 'noti-1',
    recipientId: mockBuyerId,
    type: 'ORDER',
    title: 'Đơn hàng mới',
    content: 'Đơn hàng của bạn đã được đặt thành công.',
    isRead: false,
    createdAt: '2026-09-16T10:00:00.000Z',
    readAt: null,
  };

  it('[RB-LTT07] markAsRead() trên notification isRead=false, readAt=null -> kết quả isRead=true, readAt=<now>', () => {
    const fixedNow = '2026-09-16T10:05:00.000Z';
    const result = markNotificationAsRead(unreadNotification, fixedNow);

    assert.equal(result.isRead, true);
    assert.equal(result.readAt, fixedNow);
  });

  it('[RB-LTT07] markAsRead() gọi lần 2 trên notification đã isRead=true, readAt=T1 -> readAt giữ nguyên T1 (idempotent)', () => {
    const readNotification: Notification = {
      ...unreadNotification,
      isRead: true,
      readAt: '2026-09-16T10:05:00.000Z',
    };

    const secondCallTime = '2026-09-16T10:10:00.000Z';
    const result = markNotificationAsRead(readNotification, secondCallTime);

    assert.equal(result.isRead, true);
    assert.equal(result.readAt, '2026-09-16T10:05:00.000Z'); // Không ghi đè
  });

});
