import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { searchCiudad } from "../../../api/Ciudad.api";
import { getPosteByCiudad } from "../../../api/Poste.api";
import { CiudadInterface, PosteInterface } from "../../../interfaces/interfaces";

export interface TramoGroup {
  key: string;
  ciudadA: CiudadInterface;
  ciudadB: CiudadInterface;
  postes: PosteInterface[];
}

export interface CiudadDetalleData {
  ciudad: CiudadInterface | null;
  postes: PosteInterface[];
  tramos: TramoGroup[];
  loading: boolean;
  load: () => void;
}

/**
 * `verPostes` is whether this role holds `postes.ver`, and the city's poles are
 * not asked for without it — see `usePosteDetalleData` for why: one refused
 * read rejected the whole `Promise.all` and the city itself was discarded.
 */
export function useCiudadDetalleData(id: number, { verPostes }: { verPostes: boolean }): CiudadDetalleData {
  const [ciudad, setCiudad] = useState<CiudadInterface | null>(null);
  const [postes, setPostes] = useState<PosteInterface[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [id, verPostes]);

  useEffect(() => { load(); }, [load]);

  // Group postes by unique tramo (sorted pair of city IDs)
  const tramos: TramoGroup[] = Object.values(
    postes.reduce((acc, p) => {
      if (!p.ciudadA || !p.ciudadB) return acc;
      const key = [p.id_ciudadA, p.id_ciudadB].sort().join("-");
      if (!acc[key]) {
        acc[key] = { key, ciudadA: p.ciudadA, ciudadB: p.ciudadB, postes: [] };
      }
      acc[key].postes.push(p);
      return acc;
    }, {} as Record<string, TramoGroup>)
  );

  return { ciudad, postes, tramos, loading, load };
}
