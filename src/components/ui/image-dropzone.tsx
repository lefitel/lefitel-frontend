import { useRef } from "react";
import { UploadCloudIcon, XIcon } from "lucide-react";

interface ImageDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string;
  error?: string;
  readOnly?: boolean;
}

export function ImageDropzone({ file, onChange, existingUrl, error, readOnly }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = file || existingUrl;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f?.type.startsWith("image/")) onChange(f);
  };

  if (readOnly) {
    return existingUrl ? (
      <img src={existingUrl} alt="preview" className="w-full h-auto block rounded-lg border border-border" />
    ) : null;
  }

  return (
    <div className="space-y-1.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {hasImage ? (
        <div
          className="relative rounded-lg overflow-hidden border border-border group cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <img
            src={file ? URL.createObjectURL(file) : existingUrl!}
            alt="preview"
            className="w-full h-auto block"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
              <UploadCloudIcon className="h-4 w-4" />
              Cambiar imagen
            </span>
          </div>
          {file && (
            <button
              type="button"
              className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
            >
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div
          className="h-44 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <UploadCloudIcon className="h-8 w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Arrastra una imagen aquí</p>
            <p className="text-xs text-muted-foreground mt-0.5">o haz clic para seleccionar</p>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
