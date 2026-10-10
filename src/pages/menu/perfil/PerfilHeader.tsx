import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CameraIcon, Loader2Icon } from "lucide-react";
import { imageUrl } from "../../../lib/imageUrl";
import type { UsuarioInterface } from "../../../interfaces/interfaces";

/** Same ceiling `Upload.api.ts` compresses down to, refused here before the wait. */
const MAX_MB = 4;

interface Props {
  usuario: UsuarioInterface | null;
  loading: boolean;
  /** Uploads the file and saves the path. Resolves true if the photo changed. */
  onCambiarFoto: (file: File) => Promise<boolean>;
}

/**
 * Who this page belongs to: photo, name, login name, role.
 *
 * **The photo is the point of this component.** `image` has always been an
 * editable field on the server — it is on `usuario.controller.ts`'s
 * `EDITABLE_FIELDS` — and `UsuarioSheet` has always been able to set it, which
 * meant an administrator could change your photo and you could not. The only
 * way to change your own was to open the user-administration screen, which
 * needs the Seguridad permission most accounts do not have.
 *
 * **No dialog.** Pressing the camera opens the file picker and the chosen
 * photo is uploaded and saved on the spot. A confirmation step here would be
 * asking somebody to approve a decision they already made by picking the file,
 * and the operation is its own undo: pick another one. What replaces the
 * dialog is feedback — the avatar shows a spinner while the upload runs, and
 * the new photo appearing is the confirmation.
 *
 * `accept="image/*"` filters the picker, not the file: a renamed `.exe` still
 * arrives here, which is why the size check below is a courtesy and the server
 * remains the thing that decides what an upload may be.
 */
export default function PerfilHeader({ usuario, loading, onCambiarFoto }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const iniciales = usuario
    ? `${usuario.name?.[0] ?? ""}${usuario.lastname?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared straight away so choosing the same file twice in a row still
    // fires a change event — without this the input keeps the old value and the
    // second attempt looks like nothing happened.
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return toast.warning("El archivo debe ser una imagen.");
    }
    // `uploadImage` compresses anything over this rather than refusing it, so
    // the ceiling here is generous on purpose: it only catches the file that
    // was never a photo, not the one from a modern phone camera.
    if (file.size > MAX_MB * 4 * 1024 * 1024) {
      return toast.warning("La imagen es demasiado grande.");
    }

    setSubiendo(true);
    try {
      if (await onCambiarFoto(file)) toast.success("Foto actualizada.");
    } finally {
      setSubiendo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={elegir}
        aria-hidden="true"
        tabIndex={-1}
      />

      <div className="relative shrink-0">
        <Avatar className="h-16 w-16 border-2 border-border shadow">
          {usuario?.image && <AvatarImage src={imageUrl(usuario.image) ?? undefined} alt="" />}
          <AvatarFallback className="text-lg font-bold">{iniciales}</AvatarFallback>
        </Avatar>

        {subiendo && (
          <div className="absolute inset-0 rounded-full bg-background/70 flex items-center justify-center">
            <Loader2Icon className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          aria-label="Cambiar foto de perfil"
          className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full border border-border bg-card shadow-sm
                     flex items-center justify-center text-foreground transition-colors
                     hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                     disabled:opacity-50"
        >
          <CameraIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight truncate">
          {usuario?.name} {usuario?.lastname}
        </h1>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <span className="text-sm text-muted-foreground font-mono">@{usuario?.user}</span>
          {usuario?.rol?.name && (
            <Badge variant="outline" className="text-xs font-normal">
              {usuario.rol.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
