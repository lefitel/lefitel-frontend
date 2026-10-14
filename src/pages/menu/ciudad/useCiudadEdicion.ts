import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { editCiudad } from "../../../api/Ciudad.api";
import { mensajeDeError } from "../../../api/descarga";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { useFotoSubida } from "../tramo/red/useFotoSubida";

export interface CiudadEdicion {
  name: string;
  lat: number;
  lng: number;
  /** A photo chosen and not saved yet. */
  foto: File | null;
  setName: (name: string) => void;
  setPosicion: (lat: number, lng: number) => void;
  setFoto: (foto: File | null) => void;
  /** Whether the draft differs from the city as it is stored. */
  cambiado: boolean;
  guardando: boolean;
  errores: { name?: string; posicion?: string };
  guardar: () => Promise<void>;
  descartar: () => void;
}

/**
 * The city's name, position and photo as they are being edited on its own
 * sheet, and the one write that saves the three.
 *
 * Nothing reaches the server until `guardar`: moving a city moves an end of
 * every tramo it is on, and that is not something to do a field at a time.
 * The draft is taken from the city again whenever the city is reloaded.
 */
export function useCiudadEdicion(ciudad: CiudadInterface | null, alGuardar: () => void): CiudadEdicion {
  const [name, setNameCrudo] = useState(ciudad?.name ?? "");
  const [lat, setLat] = useState(ciudad?.lat ?? 0);
  const [lng, setLng] = useState(ciudad?.lng ?? 0);
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<CiudadEdicion["errores"]>({});
  const { subir, olvidar } = useFotoSubida();

  const descartar = useCallback(() => {
    setNameCrudo(ciudad?.name ?? "");
    setLat(ciudad?.lat ?? 0);
    setLng(ciudad?.lng ?? 0);
    setFoto(null);
    setErrores({});
    olvidar();
  }, [ciudad, olvidar]);

  // Taken from the city again when the city changes — during render, not in an
  // effect: an effect left one painted frame with the new city under the old
  // draft, which on the first load was a title with no name in it.
  const [base, setBase] = useState(ciudad);
  if (base !== ciudad) {
    setBase(ciudad);
    setNameCrudo(ciudad?.name ?? "");
    setLat(ciudad?.lat ?? 0);
    setLng(ciudad?.lng ?? 0);
    setFoto(null);
    setErrores({});
  }
  useEffect(() => { olvidar(); }, [ciudad, olvidar]);

  const setName = useCallback((valor: string) => {
    setNameCrudo(valor);
    setErrores((e) => (e.name ? { ...e, name: undefined } : e));
  }, []);

  const setPosicion = useCallback((nuevaLat: number, nuevaLng: number) => {
    setLat(nuevaLat);
    setLng(nuevaLng);
    setErrores((e) => (e.posicion ? { ...e, posicion: undefined } : e));
  }, []);

  const cambiado = !!ciudad && (
    name.trim() !== (ciudad.name ?? "").trim() || lat !== ciudad.lat || lng !== ciudad.lng || foto !== null
  );

  const guardar = async () => {
    if (!ciudad || guardando) return;
    const nuevos: CiudadEdicion["errores"] = {};
    if (!name.trim()) nuevos.name = "El nombre es requerido";
    // 0,0 is what "not placed yet" is stored as.
    if (lat === 0 && lng === 0) nuevos.posicion = "La ciudad necesita una posición";
    if (nuevos.name || nuevos.posicion) { setErrores(nuevos); return; }

    setGuardando(true);
    try {
      let image = ciudad.image ?? "";
      if (foto) {
        const r = await subir(foto);
        if (!r.ok) { toast.error(r.message); return; }
        image = r.path;
      }
      await editCiudad({ ...ciudad, name: name.trim(), lat, lng, image });
      toast.success("Ciudad actualizada");
      olvidar();
      alGuardar();
    } catch (error) {
      // The server's sentence: the usual refusal is a repeated name or
      // coordinates out of range, and only it says which.
      toast.error(mensajeDeError(error, "No se pudo guardar los cambios"));
    } finally {
      setGuardando(false);
    }
  };

  return { name, lat, lng, foto, setName, setPosicion, setFoto, cambiado, guardando, errores, guardar, descartar };
}
