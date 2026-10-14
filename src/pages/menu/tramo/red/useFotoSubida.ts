import { useCallback, useRef } from "react";
import { uploadImage, type UploadResult } from "../../../../api/Upload.api";

/**
 * Uploads a photo once per file. When a save fails after the upload and is tried
 * again with the same file, `subir` hands back the path of the first upload instead
 * of sending the file a second time (which would leave the first copy on the server
 * with nothing pointing at it). `olvidar` drops that memory, for when the photo has
 * been saved and the file is no longer a pending change.
 */
export function useFotoSubida(): { subir: (file: File) => Promise<UploadResult>; olvidar: () => void } {
  const subida = useRef<{ file: File; path: string } | null>(null);
  const subir = useCallback(async (file: File): Promise<UploadResult> => {
    if (subida.current?.file === file) return { ok: true, path: subida.current.path };
    const r = await uploadImage(file);
    if (r.ok) subida.current = { file, path: r.path };
    return r;
  }, []);
  const olvidar = useCallback(() => { subida.current = null; }, []);
  return { subir, olvidar };
}
