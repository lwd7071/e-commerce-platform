import { describe, it, expect } from "vitest";
import { validateMediaFile, uploadMedia } from "../src/lib/api/media.api";

describe("Media Upload Helper (Người 1 - TDD)", () => {
  it("chấp nhận file ảnh hợp lệ (JPEG, PNG, WebP) dưới 5MB", () => {
    const validFile = {
      name: "avatar.png",
      size: 1024 * 1024 * 2, // 2MB
      type: "image/png",
    };
    const res = validateMediaFile(validFile);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("chặn file có dung lượng vượt quá 5MB", () => {
    const oversizedFile = {
      name: "heavy-photo.jpg",
      size: 5 * 1024 * 1024 + 100, // > 5MB
      type: "image/jpeg",
    };
    const res = validateMediaFile(oversizedFile);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("5MB");
  });

  it("chặn file sai định dạng không phải hình ảnh", () => {
    const invalidFormat = {
      name: "document.pdf",
      size: 1024 * 100,
      type: "application/pdf",
    };
    const res = validateMediaFile(invalidFormat);
    expect(res.valid).toBe(false);
    expect(res.error?.toLowerCase()).toContain("định dạng");
  });

  it("uploadMedia ném lỗi nếu file không hợp lệ", async () => {
    const badFile = new File(["bad content"], "test.exe", { type: "application/x-msdownload" });
    await expect(uploadMedia(badFile)).rejects.toThrow(/định dạng/i);
  });

  it("uploadMedia trả về URL hợp lệ khi upload thành công ở chế độ fallback/mock", async () => {
    const goodFile = new File(["dummy image"], "product.webp", { type: "image/webp" });
    const url = await uploadMedia(goodFile);
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
  });
});
