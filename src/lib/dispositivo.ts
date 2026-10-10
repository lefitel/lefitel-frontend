export type FormaDispositivo = "movil" | "tablet" | "escritorio";

/**
 * A user agent, read the only way a user agent can honestly be read: by
 * guessing.
 *
 * Every browser lies in this header — Chrome claims to be Safari, Edge claims
 * to be Chrome, and all of them claim to be Mozilla — so the order of these
 * checks is the whole algorithm. Edge before Chrome, Chrome before Safari,
 * because each of those strings contains the ones after it.
 *
 * This is for recognition, not analytics. The person reading it needs to
 * answer one question — "is that me, or is that the laptop I left at the
 * office" — and "Chrome en Windows" answers it. Getting the browser subtly
 * wrong costs nothing: in the session list the IP and the date beside it are
 * what settle a real doubt, and as the suggested name of a passkey it is a
 * starting point the person can retype.
 *
 * `nombre` is `null` when neither half could be read, so each caller words
 * its own fallback.
 */
export function describirDispositivo(ua: string | null): { nombre: string | null; forma: FormaDispositivo } {
  if (!ua) return { nombre: null, forma: "escritorio" };

  const s = ua.toLowerCase();

  const navegador =
    s.includes("edg/") || s.includes("edga") ? "Edge"
    : s.includes("opr/") || s.includes("opera") ? "Opera"
    : s.includes("firefox") || s.includes("fxios") ? "Firefox"
    : s.includes("chrome") || s.includes("crios") ? "Chrome"
    : s.includes("safari") ? "Safari"
    : null;

  const sistema =
    s.includes("android") ? "Android"
    : s.includes("iphone") ? "iPhone"
    : s.includes("ipad") ? "iPad"
    : s.includes("windows") ? "Windows"
    : s.includes("mac os") || s.includes("macintosh") ? "macOS"
    : s.includes("linux") ? "Linux"
    : null;

  const forma: FormaDispositivo =
    s.includes("ipad") || s.includes("tablet") ? "tablet"
    : s.includes("mobi") || s.includes("android") || s.includes("iphone") ? "movil"
    : "escritorio";

  const nombre = navegador && sistema ? `${navegador} en ${sistema}` : navegador ?? sistema;

  return { nombre, forma };
}
