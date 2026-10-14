import { hasCoords, type LatLng } from "../components/map/mapGeo";

/**
 * The poles of one stretch in the order the cable visits them, worked out from
 * where they stand.
 *
 * **This is a guess, and a stopgap.** Nothing stored says which pole follows
 * which: a pole only knows the tramo it lies on, and a tramo only its two
 * cities. Until that order is kept in the database, every screen that draws a
 * stretch has to rebuild it, and this is the one place that does.
 *
 * It replaces a sort that was copied into four screens: each pole's progress
 * along the straight line from one end to the other. That had two ways to
 * fail, and the data holds both. Thirteen cities carry a placeholder position
 * — the same point for all of them — so for their stretches the line between
 * the ends has no length, every pole measures zero along it, and the poles
 * stayed in the order they were registered: the line jumped all over the
 * stretch. And a cable that follows a bending road is not ordered by a
 * straight line at all.
 *
 * What it does instead:
 *
 *  1. A city is only trusted when it lies near its own poles; a pole is only
 *     kept when it lies between two trusted cities.
 *  2. From one end, always on to the nearest pole not yet visited, then the
 *     crossings that leaves are undone.
 *  3. A leap far longer than the stretch's ordinary gap ends the line there,
 *     and the larger side is the one kept.
 *
 * The thresholds below are judgement, not measurement. They are generous on
 * purpose: poles are registered as incidents happen, so a real one can stand
 * tens of kilometres from the next one registered.
 */

/** A city farther than this from the middle of its poles is not where it says. */
const CIUDAD_MAX_KM = 300;
/** Between two trusted cities, how much longer than the direct way a detour through a pole may be. */
const DESVIO_MAX = 2;
const DESVIO_MARGEN_KM = 20;
/** A gap this many times the stretch's median gap — and never less than the floor — breaks the line. */
const SALTO_FACTOR = 10;
const SALTO_MIN_KM = 100;

export interface TramoOrdenado<P> {
  /** The poles along the stretch, first to last. */
  postes: P[];
  /** Poles that have a position but not one the line can honestly pass through. */
  descartados: P[];
  /** The city at each end, when the line can be drawn as far as it. */
  inicio: LatLng | null;
  fin: LatLng | null;
  /** `[lat, lng]` pairs to draw when there is no road route. */
  linea: [number, number][];
  /** `[lng, lat]` pairs, the order the routing service takes. */
  waypoints: number[][];
}

type XY = { x: number; y: number };

const KM_PER_DEG = 111.2;

/** Flat kilometres around a reference latitude: exact enough within one stretch, and cheap to compare. */
function projector(refLat: number) {
  const k = Math.cos((refLat * Math.PI) / 180);
  return (p: LatLng): XY => ({ x: p.lng * KM_PER_DEG * k, y: p.lat * KM_PER_DEG });
}

const dist = (a: XY, b: XY) => Math.hypot(a.x - b.x, a.y - b.y);

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function enRango(p: LatLng | null | undefined): p is LatLng {
  return !!p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
}

/** The poles that have a position, the flat projection for this stretch, and each city if it can be trusted. */
function situar<P extends LatLng>(todos: P[], extremoUno?: LatLng | null, extremoDos?: LatLng | null) {
  const conCoords = todos.filter((p) => hasCoords(p) && enRango(p));

  const centro: LatLng | null = conCoords.length
    ? { lat: median(conCoords.map((p) => p.lat)), lng: median(conCoords.map((p) => p.lng)) }
    : null;
  const xy = projector(centro?.lat ?? extremoUno?.lat ?? 0);

  // The median of the poles, not their mean: one pole stored on another
  // continent must not drag the middle of the stretch towards it.
  const creible = (c: LatLng | null | undefined): c is LatLng =>
    enRango(c) && hasCoords(c) && (!centro || dist(xy(c), xy(centro)) <= CIUDAD_MAX_KM);
  const inicio = creible(extremoUno) ? { lat: extremoUno.lat, lng: extremoUno.lng } : null;
  const fin = creible(extremoDos) ? { lat: extremoDos.lat, lng: extremoDos.lng } : null;

  return { conCoords, xy, inicio, fin };
}

/**
 * The cities of a stretch that a map may frame: those that lie near its poles.
 * For a screen that only needs to know where to look, not the order.
 */
export function extremosCreibles(
  postes: LatLng[],
  extremoUno?: LatLng | null,
  extremoDos?: LatLng | null,
): LatLng[] {
  const { inicio, fin } = situar(postes, extremoUno, extremoDos);
  return [inicio, fin].filter((c) => c !== null);
}

export function ordenarTramo<P extends LatLng>(
  todos: P[],
  extremoUno?: LatLng | null,
  extremoDos?: LatLng | null,
): TramoOrdenado<P> {
  const { conCoords, xy, inicio, fin } = situar(todos, extremoUno, extremoDos);

  let candidatos = conCoords;
  const descartados: P[] = [];
  if (inicio && fin) {
    const a = xy(inicio), b = xy(fin);
    const limite = DESVIO_MAX * dist(a, b) + DESVIO_MARGEN_KM;
    candidatos = conCoords.filter((p) => {
      const dentro = dist(a, xy(p)) + dist(xy(p), b) <= limite;
      if (!dentro) descartados.push(p);
      return dentro;
    });
  }

  let orden = encadenar(candidatos, xy, inicio, fin);

  // Cut at a leap, keep the side with more poles on it.
  if (orden.length > 2) {
    const pts = orden.map(xy);
    const gaps = pts.slice(1).map((p, i) => dist(pts[i], p));
    const limite = Math.max(SALTO_MIN_KM, SALTO_FACTOR * median(gaps));
    const piezas: P[][] = [[orden[0]]];
    gaps.forEach((g, i) => {
      if (g > limite) piezas.push([]);
      piezas[piezas.length - 1].push(orden[i + 1]);
    });
    if (piezas.length > 1) {
      const mayor = piezas.reduce((best, pieza) => (pieza.length > best.length ? pieza : best));
      piezas.forEach((pieza) => { if (pieza !== mayor) descartados.push(...pieza); });
      orden = mayor;
    }
  }

  const puntos: LatLng[] = [...(inicio ? [inicio] : []), ...orden, ...(fin ? [fin] : [])];
  return {
    postes: orden,
    descartados,
    inicio,
    fin,
    linea: puntos.map((p): [number, number] => [p.lat, p.lng]),
    waypoints: puntos.map((p) => [p.lng, p.lat]),
  };
}

/** Nearest neighbour from one end, then 2-opt: swap any two links whose swap shortens the line. */
function encadenar<P extends LatLng>(
  postes: P[],
  xy: (p: LatLng) => XY,
  inicio: LatLng | null,
  fin: LatLng | null,
): P[] {
  if (postes.length < 2) return [...postes];
  const pts = postes.map(xy);

  // Where to start: beside the first end (the first city of the tramo's name)
  // when it can be trusted; failing that at the far end from the second;
  // failing both, at one of the two poles farthest apart — the western one,
  // so the same stretch always reads in the same direction.
  let start = 0;
  if (inicio) {
    const a = xy(inicio);
    pts.forEach((p, i) => { if (dist(a, p) < dist(a, pts[start])) start = i; });
  } else if (fin) {
    const b = xy(fin);
    pts.forEach((p, i) => { if (dist(b, p) > dist(b, pts[start])) start = i; });
  } else {
    let best = -1, e1 = 0, e2 = 0;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = dist(pts[i], pts[j]);
        if (d > best) { best = d; e1 = i; e2 = j; }
      }
    }
    start = pts[e1].x <= pts[e2].x ? e1 : e2;
  }

  const left = postes.map((_, i) => i).filter((i) => i !== start);
  const path = [start];
  while (left.length) {
    const cur = pts[path[path.length - 1]];
    let bi = 0;
    left.forEach((idx, k) => { if (dist(cur, pts[idx]) < dist(cur, pts[left[bi]])) bi = k; });
    path.push(left.splice(bi, 1)[0]);
  }

  // The first pole stays first. The second end, when trusted, is a fixed
  // point past the last one, so the line is also judged by how it arrives
  // there.
  const end = fin ? xy(fin) : null;
  const at = (k: number): XY | null => (k < path.length ? pts[path[k]] : end);
  let improved = true;
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false;
    for (let i = 0; i < path.length - 1; i++) {
      for (let j = i + 1; j < path.length; j++) {
        const after = at(j + 1);
        const before = dist(pts[path[i]], pts[path[i + 1]]) + (after ? dist(pts[path[j]], after) : 0);
        const swapped = dist(pts[path[i]], pts[path[j]]) + (after ? dist(pts[path[i + 1]], after) : 0);
        if (swapped + 1e-9 < before) {
          for (let l = i + 1, r = j; l < r; l++, r--) [path[l], path[r]] = [path[r], path[l]];
          improved = true;
        }
      }
    }
  }

  return path.map((i) => postes[i]);
}
