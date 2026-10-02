import { AppError, DependencyUnavailableError } from '../../platform/errors/app-error.ts';

export interface ShippingQuoteInput {
  readonly pickupAddress: string;
  readonly pickupProvince: string;
  readonly pickupWard: string;
  readonly deliveryAddress: string;
  readonly deliveryProvince: string;
  readonly deliveryWard: string;
  readonly weightGrams: number;
}

export interface ShippingQuote {
  readonly provider: 'mock' | 'ghtk';
  readonly fee: string;
  readonly deliverable: true;
}

export interface ShippingFeeProvider {
  quote(input: ShippingQuoteInput): Promise<ShippingQuote>;
}

type GhtkFeeResponse = {
  success?: unknown;
  message?: unknown;
  fee?: {
    fee?: unknown;
    delivery?: unknown;
  };
};

interface GhtkFeeProviderOptions {
  readonly baseUrl: string;
  readonly token: string;
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

export class GhtkFeeProvider implements ShippingFeeProvider {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: GhtkFeeProviderOptions) {
    if (!options.token.trim()) throw new AppError(500, 'CONFIGURATION_ERROR', 'GHTK_API_TOKEN is required when GHTK shipping is enabled.');
    this.fetcher = options.fetcher ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  async quote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    validateWeight(input.weightGrams);
    const url = new URL('/services/shipment/fee', this.options.baseUrl);
    url.search = new URLSearchParams({
      pick_address: input.pickupAddress,
      pick_province: input.pickupProvince,
      pick_ward: input.pickupWard,
      address: input.deliveryAddress,
      province: input.deliveryProvince,
      ward: input.deliveryWard,
      weight: String(input.weightGrams),
    }).toString();

    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        headers: { Token: this.options.token },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new DependencyUnavailableError('GHTK shipping quote is temporarily unavailable.');
    }
    if (!response.ok) throw new DependencyUnavailableError('GHTK shipping quote is temporarily unavailable.');

    let body: GhtkFeeResponse;
    try {
      body = await response.json() as GhtkFeeResponse;
    } catch {
      throw new DependencyUnavailableError('GHTK returned an invalid shipping quote.');
    }
    if (body.success !== true || typeof body.fee?.fee !== 'number' || !Number.isFinite(body.fee.fee) || body.fee.fee < 0) {
      throw new DependencyUnavailableError('GHTK shipping quote is temporarily unavailable.');
    }
    if (body.fee.delivery !== true) {
      throw new AppError(422, 'SHIPPING_UNAVAILABLE', 'GHTK does not deliver to the selected address.');
    }

    return { provider: 'ghtk', fee: body.fee.fee.toFixed(2), deliverable: true };
  }
}

export class MockFeeProvider implements ShippingFeeProvider {
  async quote(input: ShippingQuoteInput): Promise<ShippingQuote> {
    validateWeight(input.weightGrams);
    return { provider: 'mock', fee: '25000.00', deliverable: true };
  }
}

function validateWeight(weightGrams: number): void {
  if (!Number.isSafeInteger(weightGrams) || weightGrams <= 0) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Shipping weight must be a positive integer number of grams.');
  }
}
