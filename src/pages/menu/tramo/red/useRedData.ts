import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getOpcionesTramo, getTramos, type CiudadDeRed, type TramoConCifras } from "../../../../api/Tramo.api";
import { getPostesDelTramo } from "../../../../api/Poste.api";
import { mensajeDeError } from "../../../../api/descarga";
import type { Departamento, PosteInterface } from "../../../../interfaces/interfaces";

export type EstadoCarga = "cargando" | "lista" | "fallo";

/**
 * Every live tramo and every city, loaded together: the map needs both to draw
 * anything, so one failing is the whole screen failing.
 */
export function useRedData(): {
  estado: EstadoCarga;
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  departamentos: Departamento[];
  /** True from the moment `recargar` is called until the last reload in flight has settled. */
  recargando: boolean;
  recargar: () => Promise<void>;
} {
  const [estado, setEstado] = useState<EstadoCarga>("cargando");
  const [tramos, setTramos] = useState<TramoConCifras[]>([]);
  const [ciudades, setCiudades] = useState<CiudadDeRed[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [recargando, setRecargando] = useState(false);
  // Reloads still waiting for their answer, stale ones included.
  const enVuelo = useRef(0);

  // Only the last question asked gets to write: a reload started right after
  // another must not be overwritten by the older answer arriving late.
  const pregunta = useRef(0);
  // What the screen shows right now, readable from inside a late callback.
  const estadoActual = useRef<EstadoCarga>("cargando");
  const poner = useCallback((e: EstadoCarga) => { estadoActual.current = e; setEstado(e); }, []);

  const recargar = useCallback(async () => {
    const esta = ++pregunta.current;
    enVuelo.current += 1;
    setRecargando(true);
    try {
      // After a failure there is nothing on screen to keep, so retrying shows the
      // loading state again; after a success the data stays put while it reloads.
      if (estadoActual.current === "fallo") poner("cargando");
      const [t, o] = await Promise.allSettled([getTramos(), getOpcionesTramo()]);
      if (esta !== pregunta.current) return;
      if (t.status === "fulfilled" && o.status === "fulfilled") {
        setTramos(t.value);
        setCiudades(o.value.ciudad);
        setDepartamentos(o.value.departamento);
        poner("lista");
        return;
      }
      const motivo = t.status === "rejected" ? t.reason : (o as PromiseRejectedResult).reason;
      toast.error(mensajeDeError(motivo, "No se pudo cargar la red"));
      // A failed reload leaves the data already drawn; only the first load can end in `fallo`.
      if (estadoActual.current !== "lista") poner("fallo");
    } finally {
      enVuelo.current -= 1;
      // Same batch as the data above, so no render sees the new data with the flag still up.
      if (enVuelo.current === 0) setRecargando(false);
    }
  }, [poner]);

  useEffect(() => { void recargar(); }, [recargar]);

  return { estado, tramos, ciudades, departamentos, recargando, recargar };
}

/** One empty list for every render with no poles, so what is memoised on them does not recompute. */
const SIN_POSTES: PosteInterface[] = [];

/** The poles of one tramo; empty while `idTramo` is null or `habilitado` is false. */
export function usePostesDelTramo(
  idTramo: number | null,
  habilitado: boolean,
): { postes: PosteInterface[]; cargando: boolean } {
  // The answer is kept with the tramo it belongs to, so a stale one is never
  // mistaken for the current tramo's.
  const [respuesta, setRespuesta] = useState<{ id: number; postes: PosteInterface[] } | null>(null);
  const pregunta = useRef(0);

  useEffect(() => {
    const esta = ++pregunta.current;
    if (idTramo === null || !habilitado) return;
    getPostesDelTramo(idTramo)
      .then((postes) => { if (esta === pregunta.current) setRespuesta({ id: idTramo, postes }); })
      .catch((error) => {
        if (esta !== pregunta.current) return;
        toast.error(mensajeDeError(error, "No se pudieron cargar los postes del tramo"));
        setRespuesta({ id: idTramo, postes: [] });
      });
  }, [idTramo, habilitado]);

  const activo = idTramo !== null && habilitado;
  const vigente = activo && respuesta?.id === idTramo;
  return { postes: vigente ? respuesta.postes : SIN_POSTES, cargando: activo && !vigente };
}
