import { useEffect, useMemo, useRef } from "react";
import { CameraIcon, ImageIcon, UploadCloudIcon, XIcon } from "lucide-react";

interface ImageDropzoneProps {
  file: File | null;
  onChange: (file: File | null) => void;
  existingUrl?: string;
  error?: string;
  readOnly?: boolean;
}

/**
 * Picking the photo, from a desk or from the foot of a pole.
 *
 * This was written for a mouse and it showed on a phone: the headline
 * instruction was "arrastra una imagen aquí", which a touch screen cannot do;
 * reaching the camera took two extra taps through the system chooser, on every
 * photo of every pole; and once a photo was in, the only hint that it could be
 * replaced lived in a `group-hover` overlay, so on a screen with no pointer it
 * never appeared at all.
 *
 * So the two devices get the affordances they actually have. Which one is
 * asked of the pointer, not of the window width — a narrow browser on a laptop
 * is still a mouse. Drag-and-drop stays wired up for everyone, because it costs
 * nothing and a touch device simply never fires it.
 */
export function ImageDropzone({ file, onChange, existingUrl, error, readOnly }: ImageDropzoneProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  /**
   * The preview URL used to be minted inline in the JSX, so every render made
   * another one and no render ever released it; they live until the tab
   * closes. One pole is nothing, a morning of them on a phone is not.
   */
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shown = preview ?? existingUrl;

  const take = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
    // Let the same file be chosen twice in a row; without this the input holds
    // the old value and the second pick fires no change event.
    e.target.value = "";
  };

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
      {/* `capture` opens the rear camera straight away; the second input is the
          way back to photos already taken, which `capture` alone would close off. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={take} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={take} />

      {shown ? (
        <div className="space-y-1.5">
          <div
            className="relative rounded-lg overflow-hidden border border-border"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <img src={shown} alt="preview" className="w-full h-auto block" />

            {/* A real button, so it answers the keyboard too — it used to be a
                div with an onClick. Only where there is a pointer to hover
                with; everywhere else the buttons below do the job. */}
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="group/swap absolute inset-0 hidden mouse:flex items-center justify-center bg-black/0 hover:bg-black/40 focus-visible:bg-black/40 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-sm font-medium text-white opacity-0 transition-opacity group-hover/swap:opacity-100 group-focus-visible/swap:opacity-100">
                <UploadCloudIcon className="h-4 w-4" />
                Cambiar imagen
              </span>
            </button>

            {file && (
              <button
                type="button"
                aria-label="Quitar imagen"
                className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Shown by default and hidden for a mouse, rather than the reverse:
              a browser that matches neither variant then still gets a way in,
              and the way in is the one that works everywhere. */}
          <div className="grid mouse:hidden grid-cols-2 gap-1.5">
            <PickButton icon={<CameraIcon className="h-4 w-4" />} label="Repetir foto" onClick={() => cameraRef.current?.click()} />
            <PickButton icon={<ImageIcon className="h-4 w-4" />} label="Galería" onClick={() => galleryRef.current?.click()} />
          </div>
        </div>
      ) : (
        <>
          <div
            className="hidden mouse:flex h-44 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors flex-col items-center justify-center gap-2 cursor-pointer"
            onClick={() => galleryRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <UploadCloudIcon className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">Arrastra una imagen aquí</p>
              <p className="text-xs text-muted-foreground mt-0.5">o haz clic para seleccionar</p>
            </div>
          </div>

          <div className="grid mouse:hidden grid-cols-2 gap-1.5">
            <PickButton icon={<CameraIcon className="h-5 w-5" />} label="Hacer foto" tall onClick={() => cameraRef.current?.click()} />
            <PickButton icon={<ImageIcon className="h-5 w-5" />} label="Galería" tall onClick={() => galleryRef.current?.click()} />
          </div>
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PickButton({
  icon,
  label,
  onClick,
  tall,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-muted/30 text-sm font-medium transition-transform active:scale-[0.98] ${
        tall ? "h-28" : "h-11 flex-row gap-2"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
