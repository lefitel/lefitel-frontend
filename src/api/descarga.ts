// Asking the server for a file, and reading what comes back.
//
// Written for the report generator, and moved here when the pole, incident and
// user lists stopped building their own files in the browser and started asking
// for them too. Nothing in it changed on the way: `generador.api.ts` still
// exports the same three names, from here.
//
// Two problems live in this module, and both are invisible until they bite.
//
// **The name.** The server chooses it and sends it in a header the browser
// hides by default. It arrives only because `app.ts` lists `Content-Disposition`
// in the CORS `exposedHeaders`; without that every download is called
// "download", and nothing anywhere errors.
//
// **The message.** A failed download arrives as a `Blob`, because that is what
// the request asked for, so `error.response.data.message` is `undefined` and
// every server sentence — the 413 that says the file is too heavy, the 429 that
// says somebody else's export is running, the 403 — collapses into whatever
// generic text the screen passes as a fallback. Reading it out of the blob is
// asynchronous, which is why there are two functions and not one.

import axios from "axios";
import { normalizado } from "./fallo";

/** Reads the name the server chose, or falls back to one the caller supplies. */
export function nombreDeFichero(header: unknown, respaldo: string): string {
  if (typeof header !== "string") return respaldo;
  // Both forms are sent: `filename*` percent-encoded so accents survive, and a
  // plain `filename` for anything that ignores RFC 5987.
  const codificado = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (codificado) {
    try {
      return decodeURIComponent(codificado[1].trim());
    } catch {
      // A malformed header must not cost the user their download.
    }
  }
  const plano = /filename="?([^";]+)"?/i.exec(header);
  return plano ? plano[1].trim() : respaldo;
}

/**
 * Extracts the server's message, which is written for the user, not the developer.
 *
 * Reads `error.normalized` first, and that is what makes the failure with **no
 * answer at all** sayable. A dead network has no `response`, so the branch
 * below finds nothing and every caller falls back to its own sentence — "Error
 * al generar el reporte" for a server that is not running. There were
 * seventeen such callers before C4 and there are fifty-five now, which is why
 * the case stopped being a corner. The normalizer in `http.ts` is the only thing that knows the
 * difference, and this is where what it knows comes out.
 *
 * The `response.data.message` branch stays underneath it, and not as a
 * belt-and-braces: an error built by hand in a test, or one raised before the
 * interceptor ever ran, has no `normalized`, and this function is called on
 * plenty of both.
 */
export const mensajeDeError = (error: unknown, respaldo: string): string => {
  const fallo = normalizado(error);
  // When the normalizer has been here, what it decided is the whole answer:
  // its sentence, or the screen's. Falling through to `response.data.message`
  // after an **empty** one would undo the one case it deliberately leaves
  // empty — the second-factor refusal, whose own interceptor has already put
  // that exact sentence on screen with a button attached.
  if (fallo) return fallo.message.trim() !== "" ? fallo.message : respaldo;
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof message === "string" && message.trim() !== "") return message;
  }
  return respaldo;
};

/** The same, for a response that came back as a `Blob` because it was a download. */
export const mensajeDeErrorAsync = async (error: unknown, respaldo: string): Promise<string> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const texto = await error.response.data.text();
      const parsed = JSON.parse(texto) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.trim() !== "") return parsed.message;
    } catch {
      // Not JSON, or an empty body. Fall through to the generic message.
    }
    return respaldo;
  }
  return mensajeDeError(error, respaldo);
};

export type FormatoDescarga = "excel" | "csv" | "pdf";

/**
 * Asks a list endpoint to build its file and hands back the bytes.
 *
 * **POST with an empty body and the parameters in the query**, which looks
 * wrong twice and is deliberate both times. POST because the server's
 * same-origin check guards only the writing verbs, so a GET that assembles a
 * spreadsheet is something any page on the internet can make a logged-in
 * employee's browser do from an `<img>` tag — and axios adds the client header
 * this application's writes carry, which a cross-site request cannot. The
 * parameters in the query because they are the listing's own, read on the
 * server by the listing's own function: a second way of saying "filtered by
 * name" is a second thing to drift.
 */
export const descargarListado = async (
  url: string,
  parametros: Record<string, unknown>,
): Promise<{ blob: Blob; filename: string }> => {
  const respuesta = await axios.post(url, null, { params: parametros, responseType: "blob" });
  return {
    blob: respuesta.data as Blob,
    // The fallback is never reached while CORS exposes the header, and it is
    // here because "never reached" and "cannot happen" are different things:
    // the cost of being wrong is a file called `undefined`.
    filename: nombreDeFichero(respuesta.headers["content-disposition"], "listado"),
  };
};
