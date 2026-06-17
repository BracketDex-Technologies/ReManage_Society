"use client";

import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md" | "lg";
  readonly?: boolean;
}

const sizeMap = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function StarRating({
  value,
  onChange,
  size = "md",
  readonly = false,
}: StarRatingProps) {
  const iconSize = sizeMap[size];

  return (
    <div className="flex items-center gap-0.5" role={readonly ? "img" : "group"} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= value;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly || !onChange}
            onClick={() => onChange?.(star)}
            className={`${readonly || !onChange ? "cursor-default" : "cursor-pointer hover:scale-110"} transition-transform disabled:opacity-100`}
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`${iconSize} ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-gray-300"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
