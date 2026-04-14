import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface PhotoLightboxProps {
  photos: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex = 0, open, onClose }: PhotoLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);

  if (!open || photos.length === 0) return null;

  const prev = () => setCurrentIndex((i) => (i > 0 ? i - 1 : photos.length - 1));
  const next = () => setCurrentIndex((i) => (i < photos.length - 1 ? i + 1 : 0));

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
        <X className="size-5" />
      </button>

      {photos.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        {photos.length > 1 && (
          <button onClick={prev} className="absolute left-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
            <ChevronLeft className="size-5" />
          </button>
        )}

        <img
          src={photos[currentIndex]}
          alt=""
          className="max-w-full max-h-full object-contain rounded-lg"
          onClick={onClose}
        />

        {photos.length > 1 && (
          <button onClick={next} className="absolute right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-10">
            <ChevronRight className="size-5" />
          </button>
        )}
      </div>
    </div>
  );
}

// Small photo badge overlay showing count
export function PhotoCountBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <rect x="7" y="7" width="18" height="18" rx="2" fill="none" />
      </svg>
      <span className="text-[10px]" style={{ fontWeight: 600 }}>{count}</span>
    </div>
  );
}