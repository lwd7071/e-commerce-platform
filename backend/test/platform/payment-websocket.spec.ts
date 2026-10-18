import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocket } from 'ws';
import { PaymentWebSocketManager } from '../../src/platform/websocket/payment-websocket.ts';

describe('PaymentWebSocketManager Real-Time Notification', () => {
  let server: http.Server;
  let wsManager: PaymentWebSocketManager;
  let port: number;

  before(async () => {
    wsManager = new PaymentWebSocketManager();
    server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    wsManager.init(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });
  });

  after(async () => {
    wsManager.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('connects, subscribes to order, and receives broadcasted PAYMENT_SUCCESS', async () => {
    const testOrderId = 'ord-test-realtime-123';
    const client = new WebSocket(`ws://127.0.0.1:${port}/api/v1/payments/ws?orderId=${testOrderId}`);

    const receivedMessages: Array<{ type?: string; [key: string]: unknown }> = [];

    await new Promise<void>((resolve, reject) => {
      client.on('message', (data) => {
        const parsed = JSON.parse(data.toString());
        receivedMessages.push(parsed);
        if (parsed.type === 'PAYMENT_SUCCESS') {
          resolve();
        }
      });

      client.on('open', () => {
        // Trigger payment broadcast once connected
        setTimeout(() => {
          wsManager.broadcastOrderPaid(testOrderId, { amount: 50000 });
        }, 50);
      });

      client.on('error', reject);
    });

    assert.ok(receivedMessages.length >= 2, 'Should receive SUBSCRIBED and PAYMENT_SUCCESS');
    assert.strictEqual(receivedMessages[0].type, 'SUBSCRIBED');
    assert.strictEqual(receivedMessages[0].orderId, testOrderId);

    assert.strictEqual(receivedMessages[1].type, 'PAYMENT_SUCCESS');
    assert.strictEqual(receivedMessages[1].orderId, testOrderId);
    assert.strictEqual(receivedMessages[1].status, 'CONFIRMED');
    assert.strictEqual(receivedMessages[1].amount, 50000);

    client.close();
  });
});
