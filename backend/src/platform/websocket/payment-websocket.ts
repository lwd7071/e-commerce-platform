import type { Server as HttpServer, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';

export interface PaymentPaidEvent {
  type: 'PAYMENT_SUCCESS';
  orderId: string;
  status: 'CONFIRMED';
  amount?: number;
  timestamp: string;
}

export class PaymentWebSocketManager {
  private wss: WebSocketServer | null = null;
  private readonly subscribers = new Map<string, Set<WebSocket>>();

  init(server: HttpServer): void {
    if (this.wss) return;

    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      try {
        const reqUrl = request.url || '';
        const parsedUrl = new URL(reqUrl, `http://${request.headers.host || 'localhost'}`);
        const pathname = parsedUrl.pathname.replace(/\/+$/, '');

        // Support both /api/v1/payments/ws and /payments/ws
        if (pathname === '/api/v1/payments/ws' || pathname === '/payments/ws') {
          const orderId = parsedUrl.searchParams.get('orderId');
          if (!orderId) {
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\nMissing orderId parameter');
            socket.destroy();
            return;
          }

          this.wss!.handleUpgrade(request, socket, head, (ws) => {
            this.wss!.emit('connection', ws, request, orderId);
          });
        }
      } catch (err) {
        console.error('[PaymentWS] Error during upgrade:', err);
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: WebSocket, _request: IncomingMessage, orderId: string) => {
      if (!this.subscribers.has(orderId)) {
        this.subscribers.set(orderId, new Set());
      }
      this.subscribers.get(orderId)!.add(ws);

      // Confirm subscription to client
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'SUBSCRIBED',
          orderId,
          timestamp: new Date().toISOString(),
        }));
      }

      // Heartbeat ping every 25 seconds to keep connection alive through Cloudflare/proxies
      const pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }, 25000);

      const cleanup = () => {
        clearInterval(pingTimer);
        const clientSet = this.subscribers.get(orderId);
        if (clientSet) {
          clientSet.delete(ws);
          if (clientSet.size === 0) {
            this.subscribers.delete(orderId);
          }
        }
      };

      ws.on('close', cleanup);
      ws.on('error', cleanup);
    });

    console.log('[PaymentWS] WebSocket server initialized on endpoint /api/v1/payments/ws');
  }

  broadcastOrderPaid(orderId: string, details?: { amount?: number }): void {
    const clientSet = this.subscribers.get(orderId);
    if (!clientSet || clientSet.size === 0) return;

    const payload: PaymentPaidEvent = {
      type: 'PAYMENT_SUCCESS',
      orderId,
      status: 'CONFIRMED',
      amount: details?.amount,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(payload);
    for (const ws of clientSet) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          console.error('[PaymentWS] Failed to send message to client:', err);
        }
      }
    }

    console.log(`[PaymentWS] Broadcasted PAYMENT_SUCCESS for order ${orderId} to ${clientSet.size} client(s)`);
  }

  close(): void {
    if (this.wss) {
      for (const set of this.subscribers.values()) {
        for (const ws of set) {
          try {
            ws.close();
          } catch {
            // ignore
          }
        }
      }
      this.subscribers.clear();
      this.wss.close();
      this.wss = null;
    }
  }
}

export const paymentWsManager = new PaymentWebSocketManager();
