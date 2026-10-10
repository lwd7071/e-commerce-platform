import { createHmac } from 'node:crypto';
import { AppError } from '../../../platform/errors/app-error.ts';

export interface PayosConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

export interface CreatePaymentLinkInput {
  orderCode: number;
  amount: number;
  description: string;
  cancelUrl: string;
  returnUrl: string;
}

export interface PaymentLinkResponse {
  bin: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
  orderCode: number;
  currency: string;
  paymentLinkId: string;
  status: string;
  checkoutUrl: string;
  qrCode: string;
}

export interface PayosWebhookData {
  orderCode: number;
  amount: number;
  description: string;
  accountNumber: string;
  reference: string;
  transactionDateTime: string;
  currency: string;
  paymentLinkId: string;
  code: string;
  desc: string;
}

export interface PayosWebhookPayload {
  code: string;
  desc: string;
  data: PayosWebhookData;
  signature: string;
}

export class PayosService {
  private readonly baseUrl = 'https://api-merchant.payos.vn/v2/payment-requests';

  constructor(private readonly config: PayosConfig) {}

  private sortAndStringify(data: Record<string, unknown>): string {
    const sortedKeys = Object.keys(data).sort();
    return sortedKeys
      .map((key) => {
        let val = data[key];
        if (val === null || val === undefined) val = '';
        if (typeof val === 'object') val = JSON.stringify(val);
        return `${key}=${val}`;
      })
      .join('&');
  }

  createSignature(data: Record<string, unknown>): string {
    const rawData = this.sortAndStringify(data);
    return createHmac('sha256', this.config.checksumKey).update(rawData).digest('hex');
  }

  verifyWebhook(payload: PayosWebhookPayload): boolean {
    if (!payload?.data || !payload?.signature) return false;
    const computedSignature = this.createSignature(payload.data as unknown as Record<string, unknown>);
    return computedSignature.toLowerCase() === payload.signature.toLowerCase();
  }

  async createPaymentLink(input: CreatePaymentLinkInput): Promise<PaymentLinkResponse> {
    const signData = {
      amount: input.amount,
      cancelUrl: input.cancelUrl,
      description: input.description,
      orderCode: input.orderCode,
      returnUrl: input.returnUrl,
    };
    const signature = this.createSignature(signData);

    // If client ID is dummy / test without real network, or live
    if (!this.config.clientId || this.config.clientId.includes('dummy')) {
      return {
        bin: '970422',
        accountNumber: '0123456789',
        accountName: 'SAN TMDT DINO',
        amount: input.amount,
        description: input.description,
        orderCode: input.orderCode,
        currency: 'VND',
        paymentLinkId: `mock-payos-${input.orderCode}`,
        status: 'PENDING',
        checkoutUrl: `https://payos.vn/mock-checkout/${input.orderCode}`,
        qrCode: `vietqr://mock?orderCode=${input.orderCode}&amount=${input.amount}`,
      };
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.config.clientId,
          'x-api-key': this.config.apiKey,
        },
        body: JSON.stringify({
          ...signData,
          signature,
        }),
      });

      const body = (await response.json()) as { code: string; desc: string; data?: PaymentLinkResponse };
      if (!response.ok || body.code !== '00' || !body.data) {
        throw new AppError(400, 'PAYOS_ERROR', `PayOS Error: ${body.desc || response.statusText}`);
      }

      return body.data;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, 'PAYOS_CONNECTION_ERROR', 'Không thể kết nối đến cổng thanh toán PayOS.');
    }
  }
}
