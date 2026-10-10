"use client";

import React, { useState } from "react";

export interface StarRatingProps {
  value: number;
  maxStars?: number;
  onChange?: (val: number) => void;
  readOnly?: boolean;
  size?: "sm" | "md" | "lg";
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  value = 0,
  maxStars = 5,
  onChange,
  readOnly = false,
  size = "md",
  showValue = false,
  className = "",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const activeValue = hoverValue !== null ? hoverValue : value;

  const starSizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role={readOnly ? "img" : "radiogroup"}
      aria-label={`Đánh giá ${value} trên ${maxStars} sao`}
    >
      <div className="flex items-center">
        {Array.from({ length: maxStars }, (_, index) => {
          const starNumber = index + 1;
          const isFilled = activeValue >= starNumber;
          const isHalf = !isFilled && activeValue >= starNumber - 0.5;

          if (readOnly) {
            return (
              <span key={starNumber} className="p-0.5 text-amber-400">
                <svg
                  className={starSizeClasses}
                  fill={isFilled || isHalf ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                  />
                </svg>
              </span>
            );
          }

          return (
            <button
              key={starNumber}
              type="button"
              role="radio"
              aria-checked={value === starNumber}
              aria-label={`${starNumber} trên ${maxStars} sao`}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-amber-400 hover:scale-110 active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-[var(--primary)] rounded-md"
              onClick={() => onChange?.(starNumber)}
              onMouseEnter={() => setHoverValue(starNumber)}
              onMouseLeave={() => setHoverValue(null)}
              onFocus={() => setHoverValue(starNumber)}
              onBlur={() => setHoverValue(null)}
            >
              <svg
                className={starSizeClasses}
                fill={isFilled ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
      </div>

      {showValue && (
        <span className="text-xs font-semibold text-[var(--foreground)] ml-1 tabular-nums">
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}
