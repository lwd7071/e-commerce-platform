import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/data-states";
import { FormField, TextInput } from "@/components/ui/form-controls";
import { StatusBadge } from "@/components/ui/status-badge";

const globalStyles = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function cssColor(name: string): string {
  const match = globalStyles.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match) throw new Error(`Missing CSS color token: ${name}`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid RGB color: ${hex}`);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground: string, background: string): number {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("semantic text contrast tokens", () => {
  it.each([
    ["--success-text", "--success-surface"],
    ["--warning-text", "--warning-surface"],
    ["--danger-text", "--danger-surface"],
  ])("%s has WCAG AA normal-text contrast on %s", (foregroundToken, surfaceToken) => {
    expect(contrastRatio(cssColor(foregroundToken), cssColor(surfaceToken))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps white text legible on the primary CTA background", () => {
    expect(contrastRatio("#ffffff", cssColor("--primary-active"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("shared UI server-rendered contracts", () => {
  it("renders Button variants, native disabled state and loading semantics", () => {
    const html = renderToStaticMarkup(
      <Button variant="secondary" disabled aria-describedby="save-help">Lưu thay đổi</Button>,
    );
    expect(html).toContain('class="button button--secondary"');
    expect(html).toContain('type="button"');
    expect(html).toContain("disabled");
    expect(html).toContain('aria-describedby="save-help"');

    const loading = renderToStaticMarkup(<Button loading>Đang lưu</Button>);
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("disabled");
  });

  it("connects FormField label, help text and error to its control", () => {
    const html = renderToStaticMarkup(
      <FormField id="email" label="Email" required helpText="Dùng email đăng nhập" error="Email chưa hợp lệ">
        <TextInput id="email" type="email" />
      </FormField>,
    );
    expect(html).toContain('for="email"');
    expect(html).toContain('id="email-help"');
    expect(html).toContain('id="email-error"');
    expect(html).toContain('aria-describedby="email-help email-error"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('role="alert"');
  });

  it("renders an actionable EmptyState with its accessible heading", () => {
    const html = renderToStaticMarkup(
      <EmptyState title="Chưa có đơn hàng" description="Đơn hàng mới sẽ xuất hiện ở đây." action={{ label: "Khám phá", onClick: () => undefined }} />,
    );
    const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(html).toContain(`id="${titleId}"`);
    expect(html).toContain("Chưa có đơn hàng");
    expect(html).toContain("Khám phá");
  });

  it("renders ErrorState recovery action and optional request identifier", () => {
    const html = renderToStaticMarkup(<ErrorState requestId="req_12345" onRetry={() => undefined} />);
    const titleId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(titleId).toBeTruthy();
    expect(html).toContain(`id="${titleId}"`);
    expect(html).toContain("Chưa tải được dữ liệu");
    expect(html).toContain("req_12345");
    expect(html).toContain("Thử lại");
  });

  it("renders a localized order status with a decorative indicator", () => {
    const html = renderToStaticMarkup(<StatusBadge status="COMPLETED" />);
    expect(html).toContain("Hoàn thành");
    expect(html).toContain('class="status-badge status-badge--completed"');
    expect(html).toContain('aria-hidden="true"');
  });
});
