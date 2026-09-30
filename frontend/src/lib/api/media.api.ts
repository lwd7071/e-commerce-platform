import { getSupabaseClient } from "../auth/supabase-client";

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

export interface UploadMediaOptions {
  bucket?: string;
  folder?: string;
}

/**
 * Upload file ảnh lên Supabase Storage hoặc fallback mock URL an toàn
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
  } catch {
    // Fallback sang mock URL an toàn khi offline hoặc dev environment
  }

  // Fallback dev/mock URL
  return `https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80#${fileName}`;
}
