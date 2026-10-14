// A tramo's name, with each city in it a link to that city's page.
//
// The name belongs to the server. This component takes the two cities apart
// only to make them clickable, and only when the two labels it would write
// (the city's name trimmed, or `#<id>` for one with no name) joined by " – "
// come out exactly as `tramo.nombre`. If they do not, for whatever reason, it
// prints `tramo.nombre` as plain text and links nothing: a link is never worth
// showing a name the rest of the app disagrees with.
//
// It renders a fragment, so the caller's wrapper decides size, colour and
// layout. A click on a city does not reach the row it sits in.

import type { MouseEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Tramo } from "../interfaces/interfaces";

const SEPARADOR = " – ";

interface Props {
  tramo: Tramo | null | undefined;
  /** What to show for a missing tramo. Nothing by default. */
  vacio?: ReactNode;
  /** Classes of each city link. */
  linkClassName?: string;
}

const etiqueta = (c: { id: number; name: string | null }): string => c.name?.trim() || `#${c.id}`;

const noSubirAlFila = (e: MouseEvent) => e.stopPropagation();

export default function TramoEnlazado({
  tramo,
  vacio = null,
  linkClassName = "hover:underline hover:text-foreground",
}: Props) {
  if (!tramo?.nombre) return <>{vacio}</>;

  const ciudades = tramo.ciudades;
  const [a, b] = Array.isArray(ciudades) && ciudades.length === 2 ? ciudades : [];
  if (!a || !b || [etiqueta(a), etiqueta(b)].join(SEPARADOR) !== tramo.nombre) {
    return <>{tramo.nombre}</>;
  }

  return (
    <>
      <Link to={`/app/ciudades/${a.id}`} className={linkClassName} onClick={noSubirAlFila}>{etiqueta(a)}</Link>
      {SEPARADOR}
      <Link to={`/app/ciudades/${b.id}`} className={linkClassName} onClick={noSubirAlFila}>{etiqueta(b)}</Link>
    </>
  );
}
