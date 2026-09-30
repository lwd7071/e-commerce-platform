import { apiClient } from "./client";
import { features } from "../config/features";
import { envConfig } from "../config/env";

export const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export interface MediaValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Kiểm tra định dạng và dung lượng file ảnh trước khi tải lên
 */
export function validateMediaFile(file: { name: string; size: number; type: string }): MediaValidationResult {
  if (!file) {
    return { valid: false, error: "Vui lòng chọn file hình ảnh hợp lệ" };
  }

  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    return { valid: false, error: "Dung lượng ảnh vượt quá giới hạn 5 MB cho phép" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Định dạng file không được hỗ trợ. Chỉ chấp nhận JPG, PNG hoặc WebP",
    };
  }

  return { valid: true };
}

export interface PresignUploadResponse {
  media_id: string;
  upload_url: string;
  storage_path: string;
  expires_in_seconds: number;
}

export interface FinalizeUploadResponse {
  media_id: string;
  public_url: string;
  storage_path: string;
  status: string;
}

export const mediaApi = {
  presign: (filename: string, contentType: string, purpose = "product_image", productId?: string) =>
    apiClient.post<PresignUploadResponse>("/media/uploads/presign", {
      filename,
      content_type: contentType,
      purpose,
      ...(productId ? { product_id: productId } : {}),
    }),

  finalize: (mediaId: string) =>
    apiClient.post<FinalizeUploadResponse>(`/media/uploads/${mediaId}/finalize`, {}),

  attach: (mediaId: string, productId: string) =>
    apiClient.patch<{ media_id: string; attached: boolean }>(`/media/uploads/${mediaId}/attach`, {
      product_id: productId,
    }),

  deleteMedia: (mediaId: string) =>
    apiClient.delete<void>(`/media/uploads/${mediaId}`),
};

export interface UploadMediaOptions {
  bucket?: string;
  folder?: string;
  purpose?: string;
  productId?: string;
}

export interface UploadedMedia {
  url: string;
  mediaId?: string;
}

/**
 * Upload file ảnh theo luồng 3 bước: Presign -> Upload Storage -> Finalize (B-103)
 * Trong môi trường production, tuyệt đối không fallback ảnh giả nếu upload thất bại
 */
export async function uploadMediaAsset(file: File, options?: UploadMediaOptions): Promise<UploadedMedia> {
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "File không hợp lệ");
  }

  const purpose = options?.purpose || "product_image";
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${options?.folder || "uploads"}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    // Bước 1: Presign qua backend API
    const presignRes = await mediaApi.presign(file.name, file.type, purpose, options?.productId);

    // Bước 3: Upload lên upload_url bằng PUT
    const uploadRes = await fetch(presignRes.upload_url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
        apikey: envConfig.supabaseAnonKey,
      },
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload storage failed: ${uploadRes.statusText}`);
    }

    // Bước 4: Finalize để verify magic bytes và nhận public URL
    const finalizeRes = await mediaApi.finalize(presignRes.media_id);
    if (finalizeRes.public_url) {
      return { url: finalizeRes.public_url, mediaId: presignRes.media_id };
    }
  } catch (err: unknown) {
    if (features.isProduction() || !features.useMock()) {
      throw err instanceof Error ? err : new Error("Tải file thất bại. Vui lòng thử lại.");
    }
  }

  // Fallback demo URL is allowed only when the caller explicitly enabled mock mode.
  if (features.isProduction() || !features.useMock()) {
    throw new Error("Không thể kết nối đến máy chủ lưu trữ hình ảnh. Vui lòng thử lại.");
  }

  return { url: `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80#${fileName}` };
}

export async function uploadMedia(file: File, options?: UploadMediaOptions): Promise<string> {
  return (await uploadMediaAsset(file, options)).url;
}
