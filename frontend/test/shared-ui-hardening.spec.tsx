import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmptyState, ErrorState } from "@/components/ui/data-states";
import { ToastProvider } from "@/components/ui/toast";

function labelledHeadingIds(markup: string): string[] {
  return Array.from(markup.matchAll(/aria-labelledby="([^"]+)"/g), (match) => match[1]);
}

describe("shared data-state heading IDs", () => {
  it("gives every rendered state a unique accessible heading target", () => {
    const markup = renderToStaticMarkup(
      <>
        <EmptyState title="Cart trống" description="Thêm sản phẩm để tiếp tục." />
        <EmptyState title="Không có thông báo" description="Bạn đã xem hết." />
        <ErrorState onRetry={() => undefined} />
        <ErrorState title="Không tải được đơn hàng" onRetry={() => undefined} />
      </>,
    );

    const headingIds = labelledHeadingIds(markup);
    expect(headingIds).toHaveLength(4);
    expect(new Set(headingIds).size).toBe(headingIds.length);
    for (const id of headingIds) expect(markup).toContain(`id="${id}"`);
  });

  it("keeps an accessible polite live region in the shared toast provider", () => {
    const markup = renderToStaticMarkup(<ToastProvider><main>Page</main></ToastProvider>);
    expect(markup).toContain('role="region" aria-label="Thông báo"');
    expect(markup).toContain('aria-label="Thông báo"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-atomic="false"');
  });
});
