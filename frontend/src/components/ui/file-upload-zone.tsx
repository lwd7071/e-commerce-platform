"use client";

import React, { useState, useRef } from "react";
import { uploadMedia, validateMediaFile } from "../../lib/api/media.api";
import { Icon } from "./icon";

export interface FileUploadZoneProps {
  values: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function FileUploadZone({
  values = [],
  onChange,
  maxFiles = 5,
  disabled = false,
  className = "",
}: FileUploadZoneProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canUploadMore = values.length < maxFiles;

  const handleFiles = async (files: FileList | File[]) => {
    if (!canUploadMore || disabled) return;
    setErrorMessage(null);

    const filesToUpload = Array.from(files).slice(0, maxFiles - values.length);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    const newUrls: string[] = [];

    try {
      for (const file of filesToUpload) {
        const validation = validateMediaFile(file);
        if (!validation.valid) {
          setErrorMessage(validation.error || "File không hợp lệ");
          continue;
        }

        const url = await uploadMedia(file);
        newUrls.push(url);
      }

      if (newUrls.length > 0) {
        onChange([...values, ...newUrls]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tải ảnh thất bại";
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (indexToRemove: number) => {
    const updated = values.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Previews Grid */}
      {values.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {values.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className="group relative aspect-square rounded-lg border border-[var(--border)] bg-[var(--card-muted)] overflow-hidden flex items-center justify-center shadow-xs"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Ảnh đính kèm ${idx + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                aria-label={`Xóa ảnh ${idx + 1}`}
                disabled={disabled}
                onClick={() => handleRemove(idx)}
                className="absolute top-1 right-1 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
              >
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Box */}
      {canUploadMore ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            disabled || isUploading
              ? "opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--card-muted)]/20"
              : "border-[var(--border)] hover:border-[var(--primary)] bg-[var(--card)] hover:bg-[var(--card-muted)]/40"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple={maxFiles > 1}
            disabled={disabled || isUploading}
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--primary-subtle)] flex items-center justify-center text-[var(--primary)]">
              <Icon name="bag" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {isUploading ? "Đang tải ảnh lên..." : "Kéo thả hình ảnh hoặc bấm để chọn"}
              </p>
              <p className="text-xs text-[var(--subtext)] mt-0.5">
                Định dạng JPG, PNG, WebP • Tối đa 5MB / ảnh (còn lại {maxFiles - values.length} ảnh)
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--subtext)] text-center py-2 bg-[var(--card-muted)]/30 rounded-lg border border-[var(--border)]">
          Đã đạt giới hạn tối đa {maxFiles} ảnh
        </p>
      )}

      {errorMessage && (
        <p className="text-xs text-[var(--danger-text)] font-semibold" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
