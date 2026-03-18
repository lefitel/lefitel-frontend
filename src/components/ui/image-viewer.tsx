import { useState } from "react";
import { createPortal } from "react-dom";
import { XIcon, ZoomInIcon } from "lucide-react";

function LightboxPortal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 cursor-zoom-out"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors cursor-pointer"
        onClick={onClose}
      >
        <XIcon className="h-5 w-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl cursor-default"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImageViewer({ src, alt = "", className }: ImageViewerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className={`relative aspect-square w-full max-w-xs overflow-hidden rounded-lg border border-border cursor-zoom-in group bg-muted/30 ${className ?? ""}`}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} className="w-full h-full object-contain" />
        <div className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="bg-black/50 rounded p-1">
            <ZoomInIcon className="h-3.5 w-3.5 text-white" />
          </span>
        </div>
      </div>
      {open && <LightboxPortal src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt = "", open, onClose }: ImageLightboxProps) {
  if (!open || !src) return null;
  return <LightboxPortal src={src} alt={alt} onClose={onClose} />;
}
