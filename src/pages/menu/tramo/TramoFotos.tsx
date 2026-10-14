import { useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { ImageViewer } from "../../../components/ui/image-viewer";
import { imageUrl } from "../../../lib/imageUrl";
import { nombreDeCiudad } from "../../../lib/nombreDeCiudad";
import { FOTO_CABECERA_ALTO } from "../../../components/fotoCabecera";

/** An end of the tramo: enough of its city to name it and to show its photo. */
type Extremo = { id: number; name?: string | null; image?: string | null } | null | undefined;

/** How long each photo stays before the next one takes its place. */
export const TRAMO_FOTO_MS = 5000;

/**
 * The head of a tramo's card: the photos of its cities, one at a time, each
 * giving way to the next on its own.
 *
 * They stood side by side until 2026-10-13, each in half the card, on the
 * reasoning that a tramo has no start and no end and a carousel hides one city
 * behind the other. Isaias chose the carousel: a photo across the whole width
 * is one the place can be recognised by, and half of 384px was not. What it
 * costs is what that reasoning said — one city is out of sight at any moment —
 * so the dots say there is another and bring it up at a press.
 *
 * Only the ends that have a photo take a turn: an empty frame fading in every
 * few seconds to say "Sin imagen" would be motion about nothing. With one
 * photo it stands still; with none the head says so once.
 *
 * It waits while the pointer is on it or the focus is inside it — somebody
 * reading the caption, or about to press the photo to open it — and it does
 * not move by itself at all for whoever asked the system for less motion; the
 * dots still work.
 */
export default function TramoFotos({ ciudades }: { ciudades: readonly [Extremo, Extremo] }) {
  const fotos = ciudades.flatMap((c) => {
    const src = c ? imageUrl(c.image) : null;
    return c && src ? [{ id: c.id, nombre: nombreDeCiudad(c), src }] : [];
  });
  const n = fotos.length;

  const [turno, setTurno] = useState(0);
  const [detenido, setDetenido] = useState(false);
  // Pressing a dot starts the wait again: the photo just asked for is not
  // taken away a second later by a timer that was already running.
  const [pulsaciones, setPulsaciones] = useState(0);
  // The cities are chosen in the card and can change under this: the turn is
  // kept inside however many photos there are now.
  const actual = n > 0 ? turno % n : 0;

  useEffect(() => {
    if (n < 2 || detenido) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const reloj = window.setInterval(() => setTurno((t) => (t + 1) % n), TRAMO_FOTO_MS);
    return () => window.clearInterval(reloj);
  }, [n, detenido, pulsaciones]);

  if (n === 0) {
    const hayCiudad = ciudades.some(Boolean);
    return (
      <div className={`flex ${FOTO_CABECERA_ALTO} w-full shrink-0 items-center justify-center gap-1.5 bg-muted text-muted-foreground/40`}>
        <ImageIcon className="h-4 w-4" strokeWidth={1.5} />
        <span className="text-xs">{hayCiudad ? "Sin imagen" : "Sin ciudad"}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative ${FOTO_CABECERA_ALTO} w-full shrink-0 overflow-hidden bg-muted`}
      onMouseEnter={() => setDetenido(true)}
      onMouseLeave={() => setDetenido(false)}
      onFocus={() => setDetenido(true)}
      onBlur={() => setDetenido(false)}
    >
      <ul aria-label="Fotos de las ciudades del tramo" className="absolute inset-0">
        {fotos.map((f, i) => {
          const visible = i === actual;
          return (
            // All of them stay mounted, one over the other, so the change is a
            // fade between two pictures already loaded. The ones out of turn
            // are out of reach too: not read, not pressed.
            <li
              key={f.id}
              aria-hidden={!visible}
              className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
                visible ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              <ImageViewer src={f.src} alt={f.nombre} hero />
              {/* Over the foot of the photo, on a shade so it reads on any
                  picture; it lets presses through to the photo under it. */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/60 to-transparent px-3 pb-2 pt-6 text-sm font-semibold text-white">
                {f.nombre}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The top-left corner, the one nothing else claims: the city's name
          runs along the foot, the zoom glass the image viewer shows on hover
          sits at the bottom right — the dots were drawn over it there — and
          the card's save and discard sit at the top right. On a shade of
          their own, since no gradient darkens the top of the photo. */}
      {n > 1 && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-0.5 rounded-full bg-black/35 px-0.5">
          {fotos.map((f, i) => (
            // A target a finger can hit, around a dot small enough not to
            // cover the photo.
            <button
              key={f.id}
              type="button"
              aria-label={`Ver foto de ${f.nombre}`}
              aria-current={i === actual}
              onClick={() => { setTurno(i); setPulsaciones((p) => p + 1); }}
              className="group flex h-5 w-5 items-center justify-center rounded-full outline-offset-0 focus-visible:outline-2 focus-visible:outline-white"
            >
              <span
                className={`block h-1.5 rounded-full transition-all motion-reduce:transition-none ${
                  i === actual ? "w-4 bg-white" : "w-1.5 bg-white/60 group-hover:bg-white/90"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
