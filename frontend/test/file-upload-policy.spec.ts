import { describe, expect, it } from "vitest";
import { getPurposeFileLimit, validateUploadFile } from "../src/components/ui/file-upload-policy";

describe("FileUploadZone media policy", () => {
  it.each([
    ["product", 5],
    ["review", 3],
    ["avatar", 1],
  ] as const)("limits %s uploads to %i files", (purpose, expected) => {
    expect(getPurposeFileLimit(purpose)).toBe(expected);
  });

  it("allows a caller to choose a lower limit but never exceed the purpose policy", () => {
    expect(getPurposeFileLimit("review", 2)).toBe(2);
    expect(getPurposeFileLimit("review", 5)).toBe(3);
  });

  it.each(["image/jpeg", "image/png", "image/webp"])("accepts %s up to 5 MB", (type) => {
    expect(validateUploadFile({ name: "photo", type, size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("rejects GIF, unknown MIME types and files larger than 5 MB", () => {
    expect(validateUploadFile({ name: "animation.gif", type: "image/gif", size: 10 })).toMatch(/JPG, PNG hoặc WebP/);
    expect(validateUploadFile({ name: "text.txt", type: "text/plain", size: 10 })).toMatch(/JPG, PNG hoặc WebP/);
    expect(validateUploadFile({ name: "large.png", type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
  });
});
