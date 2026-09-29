"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { Icon } from "@/components/ui/icon";

interface ReviewMediaUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ReviewMediaUpload({
  images,
  onChange,
  maxImages = 5,
}: ReviewMediaUploadProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      setUploadError(`Bạn đã chọn tối đa ${maxImages} hình ảnh.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    // Validate size and format
    for (const file of filesToProcess) {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        setUploadError(
          `Định dạng file "${file.name}" không được hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WEBP.`
        );
        return;
      }
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        setUploadError(
          `Ảnh "${file.name}" vượt quá dung lượng tối đa 5MB. Vui lòng nén hoặc chọn ảnh nhỏ hơn.`
        );
        return;
      }
    }

    // Process files with progress simulation
    setIsUploading(true);
    setUploadProgress(20);

    const readers: Promise<string>[] = filesToProcess.map((file) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Không thể đọc file "${file.name}".`));
        reader.readAsDataURL(file);
      });
    });

    const progressTimer = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 25 : prev));
    }, 100);

    Promise.all(readers)
      .then((newImages) => {
        clearInterval(progressTimer);
        setUploadProgress(100);
        setTimeout(() => {
          onChange([...images, ...newImages]);
          setIsUploading(false);
          setUploadProgress(0);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }, 150);
      })
      .catch((err: unknown) => {
        clearInterval(progressTimer);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadError(err instanceof Error ? err.message : "Tải ảnh thất bại.");
      });
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadError(null);
    onChange(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleRetry = () => {
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-bold text-[var(--foreground)] block">
            Hình ảnh thực tế đính kèm (P-607c)
          </label>
          <p className="text-[11px] text-[var(--subtext)]">
            Đính kèm ảnh thực tế giúp cộng đồng tin cậy hơn và nhận thêm xu ưu đãi.
          </p>
        </div>
        <span className="text-xs font-semibold text-[var(--primary-active)] tabular-nums">
          {images.length}/{maxImages} ảnh
        </span>
      </div>

      {uploadError && (
        <div className="p-3 bg-[var(--danger-surface)] border border-[var(--danger-border)] rounded-lg flex items-center justify-between gap-3 text-xs text-[var(--danger)]" role="alert">
          <div className="flex items-center gap-2">
            <Icon name="warning" className="w-4 h-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="font-semibold underline hover:text-[var(--danger)] shrink-0 cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Upload progress bar */}
      {isUploading && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-[var(--subtext)]">
            <span>Đang xử lý hình ảnh...</span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--primary-active)] transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Grid of uploaded images and upload button */}
      <div className="flex flex-wrap gap-3 pt-1">
        {images.map((imgSrc, idx) => (
          <div
            key={idx}
            className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border)] group bg-[var(--card-muted)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt={`Hình ảnh đánh giá ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => handleRemoveImage(idx)}
              className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full flex items-center justify-center transition-opacity opacity-90 group-hover:opacity-100 cursor-pointer shadow-sm"
              aria-label={`Xóa ảnh ${idx + 1}`}
            >
              <Icon name="close" className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        {images.length < maxImages && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              disabled={isUploading}
              onChange={handleFileChange}
              className="hidden"
              id="review-image-file-input"
            />
            <label
              htmlFor="review-image-file-input"
              className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--primary-border)] bg-[var(--primary-surface)]/60 hover:bg-[var(--primary-surface)] flex flex-col items-center justify-center gap-1 text-[var(--primary-active)] transition-colors cursor-pointer text-center p-1"
            >
              <Icon name="camera" className="w-5 h-5" />
              <span className="text-[10px] font-semibold leading-tight">Thêm ảnh</span>
            </label>
          </div>
        )}
      </div>

      <p className="text-[11px] text-[var(--subtext)] italic">
        Hỗ trợ định dạng JPG, PNG, WEBP (Tối đa 5MB/ảnh, tối đa {maxImages} ảnh).
      </p>
    </div>
  );
}
