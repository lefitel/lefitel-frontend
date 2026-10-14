import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchCiudad } from "../../../api/Ciudad.api";
import { getPosteByCiudad } from "../../../api/Poste.api";
import { getTramos, type TramoConCifras } from "../../../api/Tramo.api";
import { CiudadInterface, PosteInterface, Tramo } from "../../../interfaces/interfaces";

export interface TramoGroup {
  key: string;
  tramo: Tramo;
  postes: PosteInterface[];
}

export interface CiudadDetalleData {
  ciudad: CiudadInterface | null;
  postes: PosteInterface[];
  tramos: TramoGroup[];
  /** The tramos with this city at one end, poles or not. Empty without `tramos.ver`. */
  tramosDeCiudad: TramoConCifras[];
  /** They were asked for and could not be read: an empty list would say "none". */
  tramosFallidos: boolean;
  loading: boolean;
  load: () => void;
}

/**
 * `verPostes` is whether this role holds `postes.ver`, and the city's poles are
 * not asked for without it — see `usePosteDetalleData` for why: one refused
 * read rejected the whole `Promise.all` and the city itself was discarded.
 *
 * `verTramos` is `tramos.ver`, and the tramos are read on their own, outside
 * that `Promise.all`, for the same reason: the city must not depend on them.
 */
export function useCiudadDetalleData(
  id: number,
  { verPostes, verTramos }: { verPostes: boolean; verTramos: boolean },
): CiudadDetalleData {
  const [ciudad, setCiudad] = useState<CiudadInterface | null>(null);
  const [postes, setPostes] = useState<PosteInterface[]>([]);
  const [tramosDeCiudad, setTramosDeCiudad] = useState<TramoConCifras[]>([]);
  const [tramosFallidos, setTramosFallidos] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // Every live tramo, narrowed here: there are under a hundred, and the list
    // is the one source that also has a tramo no pole has been placed on yet.
    const red: Promise<{ filas: TramoConCifras[]; fallo: boolean }> = verTramos
      ? getTramos().then(
          (todos) => ({ filas: todos.filter((t) => t.ciudades.some((c) => c.id === id)), fallo: false }),
          () => ({ filas: [], fallo: true }),
        )
      : Promise.resolve({ filas: [], fallo: false });
    try {
      const [c, p] = await Promise.all([
        searchCiudad(id),
        verPostes ? getPosteByCiudad(id) : Promise.resolve([]),
      ]);
      setCiudad(c);
      setPostes(p);
    } catch {
      toast.error("Error al cargar los datos de la ciudad");
    } finally {
      const { filas, fallo } = await red;
      setTramosDeCiudad(filas);
      setTramosFallidos(fallo);
      setLoading(false);
    }
  }, [id, verPostes, verTramos]);

  useEffect(() => { load(); }, [load]);

  // Group postes by their tramo. A Map and not an object keyed by id: an
  // object lists integer-like keys in numeric order, and the groups would stop
  // following the order the poles arrived in.
  const tramos: TramoGroup[] = [
    ...postes.reduce((acc, p) => {
      if (!p.id_tramo || !p.tramo) return acc;
      const grupo = acc.get(p.id_tramo) ?? { key: String(p.id_tramo), tramo: p.tramo, postes: [] };
      grupo.postes.push(p);
      return acc.set(p.id_tramo, grupo);
    }, new Map<number, TramoGroup>()).values(),
  ];

  return { ciudad, postes, tramos, tramosDeCiudad, tramosFallidos, loading, load };
}
