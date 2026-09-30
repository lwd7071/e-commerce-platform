import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FileUploadZone } from "../src/components/ui/file-upload-zone";

describe("FileUploadZone Component (Người 2 - UI/UX Pro Max & TDD)", () => {
  it("render vùng kéo thả ảnh với hướng dẫn rõ ràng", () => {
    const html = renderToStaticMarkup(
      <FileUploadZone values={[]} onChange={vi.fn()} maxFiles={5} />
    );
    expect(html).toContain("Kéo thả hình ảnh");
    expect(html).toContain("Tối đa 5MB");
  });

  it("hiển thị danh sách ảnh đã chọn kèm nút xóa đạt chuẩn touch target tối thiểu 44px", () => {
    const mockImages = [
      "https://images.unsplash.com/photo-1?w=200",
      "https://images.unsplash.com/photo-2?w=200",
    ];
    const html = renderToStaticMarkup(
      <FileUploadZone values={mockImages} onChange={vi.fn()} maxFiles={5} />
    );
    expect(html).toContain("photo-1");
    expect(html).toContain("photo-2");
    expect(html).toContain("aria-label=\"Xóa ảnh 1\"");
    expect(html).toContain("min-w-[44px]");
    expect(html).toContain("min-h-[44px]");
  });

  it("ẩn vùng upload khi đã đạt tối đa số lượng file", () => {
    const mockImages = ["img1.png", "img2.png"];
    const html = renderToStaticMarkup(
      <FileUploadZone values={mockImages} onChange={vi.fn()} maxFiles={2} />
    );
    expect(html).toContain("Đã đạt giới hạn tối đa 2 ảnh");
  });
});
