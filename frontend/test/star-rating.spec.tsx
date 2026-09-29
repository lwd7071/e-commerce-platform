import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StarRating } from "../src/components/ui/star-rating";

describe("StarRating Component (Người 2 - UI/UX Pro Max & TDD)", () => {
  it("render đúng số sao ở chế độ xem (readonly)", () => {
    const html = renderToStaticMarkup(<StarRating value={4} maxStars={5} readOnly />);
    expect(html).toContain("Đánh giá 4 trên 5 sao");
    // Có 5 ngôi sao SVG
    const starMatches = html.match(/<svg/g);
    expect(starMatches?.length).toBe(5);
  });

  it("chế độ tương tác có aria-label và nút bấm đạt chuẩn touch target tối thiểu 44px", () => {
    const html = renderToStaticMarkup(<StarRating value={3} onChange={vi.fn()} />);
    expect(html).toContain("role=\"radiogroup\"");
    expect(html).toContain("min-w-[44px]");
    expect(html).toContain("min-h-[44px]");
  });

  it("hỗ trợ hiển thị điểm đánh giá dạng số kèm theo", () => {
    const html = renderToStaticMarkup(<StarRating value={4.5} showValue readOnly />);
    expect(html).toContain("4.5");
  });
});
