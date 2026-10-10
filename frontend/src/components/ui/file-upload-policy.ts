export type MediaPurpose = "product" | "review" | "avatar";

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const PURPOSE_LIMITS: Record<MediaPurpose, number> = {
  product: 5,
  review: 3,
  avatar: 1,
};

export function getPurposeFileLimit(purpose: MediaPurpose, requestedLimit?: number): number {
  const policyLimit = PURPOSE_LIMITS[purpose];
  if (requestedLimit === undefined) return policyLimit;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) return 0;
  return Math.min(policyLimit, requestedLimit);
}

export function validateUploadFile(file: Pick<File, "name" | "size" | "type">): string | null {
  if (!ACCEPTED_UPLOAD_TYPES.includes(file.type as (typeof ACCEPTED_UPLOAD_TYPES)[number])) {
    return "Định dạng file không được hỗ trợ. Chỉ chấp nhận JPG, PNG hoặc WebP.";
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return "Dung lượng ảnh vượt quá giới hạn 5 MB.";
  }
  return null;
}
