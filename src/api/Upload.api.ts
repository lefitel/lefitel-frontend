import axios from "axios";
import imageCompression from "browser-image-compression";
import { urlApi, urlFiles } from "./url";

const MAX_MB = 4;

/**
 * What came back from an upload attempt.
 *
 * This used to be a bare `string`, with the literal `"500"` standing in for
 * every failure. Two things were wrong with that, and both are why the shape
 * changed rather than the message.
 *
 * The sentinel shared its type with the answer. Every caller had to remember to
 * compare against it, and `PerfilPage` carries the note about what happens when
 * one forgets: the failed upload gets saved, `image` becomes `"500"`, and every
 * avatar in the application starts asking the server for a file called 500.
 *
 * And it threw away what the server said. The API now answers 413 with "la
 * imagen supera el máximo de 5 MB" where it used to answer 500 with nothing
 * usable — but a caller that only ever sees `"500"` cannot pass that on, so a
 * technician in the field is told "no se pudo subir la imagen" for a photograph
 * they could simply have retaken smaller. The message is the whole point of the
 * server-side fix; this is what lets it reach a person.
 */
export type UploadResult =
  | { ok: true; path: string }
  | { ok: false; message: string };

/** What the server said, or something true when it did not answer at all. */
function motivo(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const dicho = error.response?.data?.message;
    if (typeof dicho === "string" && dicho.trim() !== "") return dicho;
    // No response at all: the request never arrived, which is a different
    // problem from one the server refused, and worth saying differently.
    if (!error.response) return "No se pudo conectar con el servidor.";
  }
  return "No se pudo subir la imagen.";
}

export const uploadImage = async (data: File): Promise<UploadResult> => {
  try {
    let file = data;
    if (data.size > MAX_MB * 1024 * 1024) {
      file = await imageCompression(data, {
        maxSizeMB: MAX_MB,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
    }
    const formData = new FormData();
    formData.append("file", file);
    // `POST /api/files/` since D1. It was `POST /api/upload/` — a verb mounted
    // as a root resource, next to the noun that manages the same files.
    //
    // 🔴 On the server this is the one route in that router **without** a
    // permission gate, and deliberately: it serves an incident photograph, a
    // pole photograph and your own portrait at once, so tying it to the
    // `archivos` module would stop a Cliente changing their own picture. If it
    // ever starts answering 403 here, that is what happened.
    const response = await axios.post(urlApi + urlFiles, formData);
    const path = response.data?.path;
    if (typeof path !== "string" || path === "") {
      // A success with nothing usable in it. Rare, and worth refusing here
      // rather than letting an empty `image` reach a row. No status is compared:
      // this route answers 201 since C4 and would have answered 200 before, and
      // either way what matters is whether a path came back.
      //
      // 🔴 `path` is the contract, and the move did not change it: the server
      // still answers `{ path }`. Aligning it with the `name` the rest of
      // `Files.api.ts` uses would break every upload in the application with a
      // message blaming the server, and no test would see it.
      return { ok: false, message: "El servidor no devolvió la imagen guardada." };
    }
    return { ok: true, path };
  } catch (error) {
    return { ok: false, message: motivo(error) };
  }
};
