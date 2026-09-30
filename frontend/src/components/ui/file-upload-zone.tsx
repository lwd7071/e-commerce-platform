"use client";

import React, { useEffect, useRef, useState } from "react";
import { getPurposeFileLimit, validateUploadFile, type MediaPurpose } from "./file-upload-policy";
import { Icon } from "./icon";

export interface FileUploadZoneProps {
  values: string[];
  onChange: (urls: string[]) => void;
  maxFiles?: number;
  purpose?: MediaPurpose;
  production?: boolean;
  disabled?: boolean;
  className?: string;
}

type LocalPreview = { id: number; name: string; url: string };

export function FileUploadZone({
  values = [],
  onChange,
  maxFiles,
  purpose = "product",
  production = process.env.NODE_ENV === "production",
  disabled = false,
  className = "",
}: FileUploadZoneProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previews, setPreviews] = useState<LocalPreview[]>([]);
  const [replacingPreviewId, setReplacingPreviewId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewId = useRef(0);
  const previewUrls = useRef(new Map<number, string>());
  const replacePreviewId = useRef<number | null>(null);

  const effectiveMaxFiles = getPurposeFileLimit(purpose, maxFiles);
  const remainingFiles = Math.max(0, effectiveMaxFiles - values.length - previews.length);
  const canUploadMore = remainingFiles > 0;

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const handleFiles = (files: FileList | File[]) => {
    const replacementId = replacePreviewId.current;
    replacePreviewId.current = null;
    setReplacingPreviewId(null);
    if (replacementId !== null) {
      const replacement = Array.from(files)[0];
      if (replacement) replacePreview(replacementId, replacement);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (!canUploadMore || disabled) return;
    setErrorMessage(null);

    const selectedFiles = Array.from(files);
    const availableCount = remainingFiles;
    const overflowMessage = selectedFiles.length > availableCount ? `Bạn chỉ có thể thêm tối đa ${availableCount} ảnh nữa.` : null;
    const filesToUpload = selectedFiles.slice(0, availableCount);
    if (filesToUpload.length === 0) return;

    let validationMessage: string | null = null;
    let addedPreview = false;
    for (const file of filesToUpload) {
      const validationError = validateUploadFile(file);
      if (validationError) {
        validationMessage = validationError;
        continue;
      }

      const id = ++previewId.current;
      const localUrl = URL.createObjectURL(file);
      previewUrls.current.set(id, localUrl);
      setPreviews((current) => [...current, { id, name: file.name, url: localUrl }]);
      addedPreview = true;
    }

    const unavailableMessage = production && addedPreview ? "Tải ảnh thật hiện chưa khả dụng. Ảnh xem trước chưa được lưu." : null;
    setErrorMessage([overflowMessage, validationMessage, unavailableMessage].filter(Boolean).join(" ") || null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemove = (indexToRemove: number) => {
    const updated = values.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  const removePreview = (id: number) => {
    const url = previewUrls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    previewUrls.current.delete(id);
    setPreviews((current) => current.filter((preview) => preview.id !== id));
  };

  const replacePreview = (id: number, file: File) => {
    const validationError = validateUploadFile(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    const oldUrl = previewUrls.current.get(id);
    const newUrl = URL.createObjectURL(file);
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    previewUrls.current.set(id, newUrl);
    setPreviews((current) => current.map((preview) => preview.id === id ? { ...preview, name: file.name, url: newUrl } : preview));
    setErrorMessage(production ? "Tải ảnh thật hiện chưa khả dụng. Ảnh xem trước chưa được lưu." : null);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={effectiveMaxFiles > 1 && replacingPreviewId === null}
        disabled={disabled}
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      {!production && <p className="dev-data-note" role="note"><Icon name="warning" />Demo: ảnh chỉ xem trước trên thiết bị, chưa được tải lên hoặc lưu.</p>}
      {previews.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3" aria-label="Ảnh đang tải lên">
          {previews.map((preview) => (
            <li key={preview.id} className="relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--card-muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={`Xem trước ${preview.name}`} className="h-full w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 p-2 text-xs text-white">
                <span className="truncate">{production ? "Media chưa khả dụng" : "Ảnh demo · chưa tải lên"}</span>
                <button type="button" aria-label={`Thay ảnh ${preview.name}`} disabled={disabled} onClick={() => { replacePreviewId.current = preview.id; setReplacingPreviewId(preview.id); fileInputRef.current?.click(); }}>Thay</button>
                <button type="button" aria-label={`Bỏ ảnh ${preview.name}`} disabled={disabled} onClick={() => removePreview(preview.id)}>Bỏ</button>
              </div>
            </li>
          ))}
        </ul>
      )}
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
        <button
          type="button"
          disabled={disabled}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`block w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
            disabled
              ? "opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--card-muted)]/20"
              : "border-[var(--border)] hover:border-[var(--primary)] bg-[var(--card)] hover:bg-[var(--card-muted)]/40"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[var(--primary-subtle)] flex items-center justify-center text-[var(--primary)]">
              <Icon name="bag" className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {production ? "Chọn ảnh để xem trước" : "Kéo thả ảnh demo hoặc bấm để chọn"}
              </p>
              <p className="text-xs text-[var(--subtext)] mt-0.5">
                Định dạng JPG, PNG, WebP • Tối đa 5 MB / ảnh (còn lại {remainingFiles} ảnh)
              </p>
            </div>
          </div>
        </button>
      ) : (
        <p className="text-xs text-[var(--subtext)] text-center py-2 bg-[var(--card-muted)]/30 rounded-lg border border-[var(--border)]">
          Đã đạt giới hạn tối đa {effectiveMaxFiles} ảnh
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
