import { describe, it, expect, vi } from "vitest";
import { validateMediaFile, uploadMedia, mediaApi } from "../src/lib/api/media.api";
import { features } from "../src/lib/config/features";

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
    expect(res.error).toContain("5 MB");
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

  it("chặn GIF theo hợp đồng upload", () => {
    const res = validateMediaFile({ name: "animation.gif", size: 1024, type: "image/gif" });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("JPG, PNG hoặc WebP");
  });

  it("uploadMedia ném lỗi nếu file không hợp lệ", async () => {
    const badFile = new File(["bad content"], "test.exe", { type: "application/x-msdownload" });
    await expect(uploadMedia(badFile)).rejects.toThrow(/định dạng/i);
  });

  it("uploadMedia trả về URL hợp lệ khi upload thành công ở chế độ fallback/mock", async () => {
    const mockSpy = vi.spyOn(features, "useMock").mockReturnValue(true);
    const goodFile = new File(["dummy image"], "product.webp", { type: "image/webp" });
    const url = await uploadMedia(goodFile);
    expect(url).toBeDefined();
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);
    mockSpy.mockRestore();
  });

  describe("Slice 4: uploadMedia 3-step Lifecycle (B-103)", () => {
    it("thực hiện đủ 3 bước: presign -> PUT upload_url -> finalize (kèm magic_bytes)", async () => {
      const presignSpy = vi.spyOn(mediaApi, "presign").mockResolvedValue({
        media_id: "media-uuid-123",
        upload_url: "https://storage.example.com/upload-target",
        storage_path: "shops/1/products/temp/media-uuid-123.png",
        expires_in_seconds: 600,
      });

      const finalizeSpy = vi.spyOn(mediaApi, "finalize").mockResolvedValue({
        media_id: "media-uuid-123",
        public_url: "https://storage.example.com/public/shops/1/products/temp/media-uuid-123.png",
        storage_path: "shops/1/products/temp/media-uuid-123.png",
        status: "FINALIZED",
      });

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(null, { status: 200 })
      );

      // PNG header: 89 50 4e 47 0d 0a 1a 0a
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const file = new File([pngBytes], "item.png", { type: "image/png" });

      const resultUrl = await uploadMedia(file, { purpose: "product_image" });

      expect(presignSpy).toHaveBeenCalledWith("item.png", "image/png", "product_image", undefined);
      expect(fetchSpy).toHaveBeenCalledWith(
        "https://storage.example.com/upload-target",
        expect.objectContaining({
          method: "PUT",
        })
      );
      expect(finalizeSpy).toHaveBeenCalledWith("media-uuid-123");
      expect(resultUrl).toBe("https://storage.example.com/public/shops/1/products/temp/media-uuid-123.png");

      presignSpy.mockRestore();
      finalizeSpy.mockRestore();
      fetchSpy.mockRestore();
    });

    it("từ chối fallback Unsplash và ném lỗi khi ở môi trường production", async () => {
      const isProdSpy = vi.spyOn(features, "isProduction").mockReturnValue(true);
      const presignSpy = vi.spyOn(mediaApi, "presign").mockRejectedValue(new Error("Network Error"));

      const file = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });

      await expect(uploadMedia(file)).rejects.toThrow();

      isProdSpy.mockRestore();
      presignSpy.mockRestore();
    });
  });
});
