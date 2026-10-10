"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { mediaApi, uploadMediaAsset, validateMediaFile } from "@/lib/api/media.api";

export interface ReviewImageUpload {
  url: string;
  mediaId?: string;
}

interface ReviewMediaUploadProps {
  images: ReviewImageUpload[];
  onChange: (images: ReviewImageUpload[]) => void;
  reviewId: string;
  maxImages?: number;
}

export function ReviewMediaUpload({ images, onChange, reviewId, maxImages = 3 }: ReviewMediaUploadProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setUploadError(null);
    const slots = maxImages - images.length;
    if (slots <= 0) {
      setUploadError(`Bạn đã chọn tối đa ${maxImages} hình ảnh.`);
      return;
    }
    const selected = files.slice(0, slots);
    for (const file of selected) {
      const validation = validateMediaFile(file);
      if (!validation.valid) {
        setUploadError(`${file.name}: ${validation.error}`);
        return;
      }
    }

    setIsUploading(true);
    setUploadProgress(0);
    const uploaded: ReviewImageUpload[] = [];
    try {
      for (const [index, file] of selected.entries()) {
        uploaded.push(await uploadMediaAsset(file, { purpose: "review_image", reviewId }));
        setUploadProgress(Math.round(((index + 1) / selected.length) * 100));
      }
      onChange([...images, ...uploaded]);
    } catch (error) {
      await Promise.all(uploaded.flatMap(({ mediaId }) => mediaId ? [mediaApi.deleteMedia(mediaId).catch(() => undefined)] : []));
      setUploadError(error instanceof Error ? error.message : "Tải ảnh thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleRemoveImage = async (index: number) => {
    setUploadError(null);
    const image = images[index];
    try {
      if (image.mediaId) await mediaApi.deleteMedia(image.mediaId);
      onChange(images.filter((_, imageIndex) => imageIndex !== index));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Không thể xóa ảnh. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label htmlFor={`review-image-file-input-${reviewId}`} className="text-xs font-bold text-[var(--foreground)] block">
            Hình ảnh thực tế đính kèm
          </label>
          <p className="text-[11px] text-[var(--subtext)]">Đính kèm ảnh thực tế để chia sẻ trải nghiệm với cộng đồng.</p>
        </div>
        <span className="text-xs font-semibold text-[var(--primary-active)] tabular-nums">{images.length}/{maxImages} ảnh</span>
      </div>

      {uploadError && <div className="p-3 bg-[var(--danger-surface)] border border-[var(--danger-border)] rounded-lg text-xs text-[var(--danger)]" role="alert">{uploadError}</div>}

      {isUploading && (
        <div className="space-y-1" role="status" aria-live="polite">
          <div className="flex justify-between text-[11px] text-[var(--subtext)]"><span>Đang tải ảnh lên...</span><span>{uploadProgress}%</span></div>
          <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-[var(--primary-active)] transition-[width] duration-200" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        {images.map((image, index) => (
          <div key={image.mediaId ?? image.url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] group bg-[var(--card-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt={`Hình ảnh đánh giá ${index + 1}`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => void handleRemoveImage(index)} disabled={isUploading} className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50 before:absolute before:-inset-2.5 before:content-[''] cursor-pointer" aria-label={`Xóa ảnh ${index + 1}`}>
              <Icon name="close" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={isUploading} onChange={(event) => void handleFileChange(event)} className="sr-only" id={`review-image-file-input-${reviewId}`} />
            <label htmlFor={`review-image-file-input-${reviewId}`} className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--primary-border)] bg-[var(--primary-surface)]/60 hover:bg-[var(--primary-surface)] focus-within:ring-2 focus-within:ring-[var(--primary-active)] flex flex-col items-center justify-center gap-1 text-[var(--primary-active)] transition-colors cursor-pointer text-center p-1">
              <Icon name="camera" className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-tight">Thêm ảnh</span>
            </label>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--subtext)] italic">JPG, PNG hoặc WebP; tối đa 5 MB/ảnh, {maxImages} ảnh cho mỗi đánh giá.</p>
    </div>
  );
}
