// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { FileUploadZone } from "../src/components/ui/file-upload-zone";

describe("FileUploadZone Component (Người 2 - UI/UX Pro Max & TDD)", () => {
  it("render vùng kéo thả ảnh với hướng dẫn rõ ràng", () => {
    const html = renderToStaticMarkup(
      <FileUploadZone values={[]} onChange={vi.fn()} maxFiles={5} />
    );
    expect(html).toContain("Kéo thả ảnh demo");
    expect(html).toContain("Tối đa 5 MB");
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

  it("shows local preview only and keeps production upload gated", () => {
    const html = renderToStaticMarkup(<FileUploadZone values={[]} onChange={vi.fn()} production />);
    expect(html).toContain("Chọn ảnh để xem trước");
    expect(html).toContain("image/jpeg,image/png,image/webp");
    expect(html).not.toContain("image/gif");
    expect(html).not.toContain("images.unsplash.com");
  });

  it("opens the file picker with keyboard activation", async () => {
    const user = userEvent.setup();
    render(<FileUploadZone values={[]} onChange={vi.fn()} />);

    const uploadButton = screen.getByRole("button", { name: /kéo thả ảnh demo/i });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const picker = vi.spyOn(fileInput, "click");
    uploadButton.focus();
    await user.keyboard("{Enter}");

    expect(document.activeElement).toBe(uploadButton);
    expect(picker).toHaveBeenCalledOnce();
  });
});
