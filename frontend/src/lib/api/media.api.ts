import { getSupabaseClient } from "../auth/supabase-client";
import { apiClient } from "./client";
import { features } from "../config/features";

export const MAX_MEDIA_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
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
    return { valid: false, error: "Dung lượng ảnh vượt quá giới hạn 5MB cho phép" };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Định dạng file không được hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP hoặc GIF",
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
  presign: (filename: string, contentType: string, purpose = "product_image") =>
    apiClient.post<PresignUploadResponse>("/media/uploads/presign", {
      filename,
      content_type: contentType,
      purpose,
    }),

  finalize: (mediaId: string, magicBytes?: string) =>
    apiClient.post<FinalizeUploadResponse>(`/media/uploads/${mediaId}/finalize`, {
      magic_bytes: magicBytes,
    }),

  deleteMedia: (mediaId: string) =>
    apiClient.delete<void>(`/media/uploads/${mediaId}`),
};

export interface UploadMediaOptions {
  bucket?: string;
  folder?: string;
  purpose?: string;
}

/**
 * Upload file ảnh lên Supabase Storage hoặc fallback mock URL an toàn
 * Trong môi trường production (B-103), không fallback ảnh giả nếu upload thất bại
 */
export async function uploadMedia(file: File, options?: UploadMediaOptions): Promise<string> {
  const validation = validateMediaFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || "File không hợp lệ");
  }

  const bucket = options?.bucket || "media";
  const folder = options?.folder || "uploads";
  const ext = file.name.split(".").pop() || "jpg";
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (!error && data) {
        const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    }
  } catch (err: unknown) {
    if (features.isProduction()) {
      throw err instanceof Error ? err : new Error("Tải file thất bại. Vui lòng thử lại.");
    }
  }

  // Fallback dev/mock URL khi không ở chế độ production
  if (features.isProduction()) {
    throw new Error("Không thể kết nối đến máy chủ lưu trữ hình ảnh. Vui lòng thử lại.");
  }

  return `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80#${fileName}`;
}
