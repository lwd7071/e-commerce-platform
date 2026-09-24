export interface LatencyStats {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface MetricSummary {
  totalRequests: number;
  totalErrors: number;
  requestsByStatus: Record<number, number>;
  requestsByRoute: Record<string, number>;
  errorsByCode: Record<string, number>;
  latency: LatencyStats;
}

export class MetricsCollector {
  private totalRequests = 0;
  private totalErrors = 0;
  private requestsByStatus: Record<number, number> = {};
  private requestsByRoute: Record<string, number> = {};
  private errorsByCode: Record<string, number> = {};
  private durations: number[] = [];

  public recordRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
    errorCode?: string
  ): void {
    this.totalRequests++;

    this.requestsByStatus[statusCode] = (this.requestsByStatus[statusCode] || 0) + 1;

    const routeKey = `${method} ${route}`;
    this.requestsByRoute[routeKey] = (this.requestsByRoute[routeKey] || 0) + 1;

    this.durations.push(durationMs);

    if (statusCode >= 400) {
      this.totalErrors++;
      if (errorCode) {
        this.errorsByCode[errorCode] = (this.errorsByCode[errorCode] || 0) + 1;
      }
    }
  }

  public getSnapshot(): MetricSummary {
    const count = this.durations.length;
    let min = 0;
    let max = 0;
    let avg = 0;
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;

    if (count > 0) {
      const sorted = [...this.durations].sort((a, b) => a - b);
      min = sorted[0];
      max = sorted[count - 1];
      const sum = sorted.reduce((acc, v) => acc + v, 0);
      avg = sum / count;

      const getPercentile = (p: number): number => {
        const index = Math.ceil((p / 100) * count) - 1;
        return sorted[Math.max(0, Math.min(index, count - 1))];
      };

      p50 = getPercentile(50);
      p95 = getPercentile(95);
      p99 = getPercentile(99);
    }

    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      requestsByStatus: { ...this.requestsByStatus },
      requestsByRoute: { ...this.requestsByRoute },
      errorsByCode: { ...this.errorsByCode },
      latency: {
        count,
        min,
        max,
        avg: Math.round(avg * 100) / 100,
        p50,
        p95,
        p99,
      },
    };
  }

  public reset(): void {
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.requestsByStatus = {};
    this.requestsByRoute = {};
    this.errorsByCode = {};
    this.durations = [];
  }
}

export const metricsCollector = new MetricsCollector();
