import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SaveIcon } from "lucide-react";
import { createCiudad } from "../../../../api/Ciudad.api";
import type { CiudadDeRed } from "../../../../api/Tramo.api";
import { mensajeDeError } from "../../../../api/descarga";
import { Button } from "../../../../components/ui/button";
import { ImageDropzone } from "../../../../components/ui/image-dropzone";
import { Input } from "../../../../components/ui/input";
import { useVivo } from "./useVivo";
import { useFotoSubida } from "./useFotoSubida";
import { useOcupado } from "./useOcupado";
import { nombreDeCiudad } from "../../../../lib/nombreDeCiudad";
import type { Accion, EstadoRed } from "./redEstado";
import { Aviso, BotonIcono, Campo, Encabezado, Pista } from "./panelUi";

interface Props {
  ciudades: CiudadDeRed[];
  estado: EstadoRed;
  despachar: (a: Accion) => void;
  recargar: () => Promise<void>;
  /** Whether a save is in flight, for the page to keep out of the way. */
  onOcupado: (ocupado: boolean) => void;
}

/**
 * A city to be placed: a point on the map, a name and, if there is one, a photo.
 *
 * Always a step of a new tramo: this is where the city it lacks is made, and
 * every way out of here leads back to that tramo, with what it had picked.
 */
export default function PanelCiudadNueva({ ciudades, estado, despachar, recargar, onOcupado }: Props) {
  const { borrador } = estado;
  const [nombre, setNombre] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const campoNombre = useRef<HTMLInputElement>(null);
  const vivo = useVivo();
  useOcupado(guardando, onOcupado);
  // When the create fails and is tried again, the same file is not uploaded a second time.
  const { subir: subirFoto } = useFotoSubida();

  // The name field appears with the first click on the map: that is when it is wanted.
  const hayBorrador = borrador !== null;
  useEffect(() => { if (hayBorrador) campoNombre.current?.focus(); }, [hayBorrador]);

  const nombreLimpio = nombre.trim();
  const repetida = nombreLimpio === ""
    ? undefined
    : ciudades.find((c) => nombreDeCiudad(c).trim().toLowerCase() === nombreLimpio.toLowerCase());

  const volver = (nueva?: number) => despachar({ tipo: "volverAlTramo", nueva });

  const guardar = async () => {
    if (!borrador || nombreLimpio === "") return;
    setGuardando(true);
    let creada: { id?: number | null };
    try {
      let image = "";
      if (foto) {
        const r = await subirFoto(foto);
        if (!r.ok) {
          toast.error(r.message);
          if (vivo.current) setGuardando(false);
          return;
        }
        image = r.path;
      }
      creada = await createCiudad({ name: nombreLimpio, image, lat: borrador.lat, lng: borrador.lng });
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo crear la ciudad"));
      if (vivo.current) setGuardando(false);
      return;
    }
    // Saved: the buttons stay off until the view is left, so a second press cannot
    // create a second city. The tramo is gone back to once the reload has brought
    // the city in — picked before that, its selector would have no name to show —
    // and only if this view is still the one on screen: the person may have left
    // it while the requests were out.
    toast.success("Ciudad creada");
    await recargar();
    if (vivo.current) volver(creada.id ?? undefined);
  };

  return (
    <div className="space-y-3">
      {/* As in the tramo card this is a step of: saving is an icon, and the
          way back is a word, because it is the only way out of here. Its full
          name stays for whoever is not looking. */}
      <Encabezado
        rotulo="Ciudad nueva para el tramo"
        titulo={!borrador ? "Pincha en el mapa" : nombreLimpio === "" ? "Ponle nombre" : nombreLimpio}
        accion={(
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" aria-label="Volver al tramo" disabled={guardando} onClick={() => volver()}>
              Volver
            </Button>
            <BotonIcono
              etiqueta="Guardar ciudad"
              disabled={!borrador || nombreLimpio === "" || guardando}
              onClick={() => void guardar()}
            >
              <SaveIcon />
            </BotonIcono>
          </div>
        )}
      />

      {borrador ? (
        <>
          <Campo etiqueta="Nombre">
            <Input
              ref={campoNombre}
              aria-label="Nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              // The draft is on its way: neither it nor its name may change now.
              readOnly={guardando}
              placeholder="Nombre de la ciudad"
            />
          </Campo>
          <p className="font-mono text-xs tabular-nums">
            {borrador.lat.toFixed(5)}, {borrador.lng.toFixed(5)}
          </p>
          <Campo etiqueta="Foto (opcional)">
            <ImageDropzone file={foto} onChange={setFoto} readOnly={guardando} />
          </Campo>
          {repetida && (
            <Aviso>
              Ya existe una ciudad con ese nombre.{" "}
              <button
                type="button"
                className="text-primary underline-offset-4 hover:underline"
                onClick={() => volver(repetida.id)}
              >
                Usarla en el tramo
              </button>
            </Aviso>
          )}
        </>
      ) : (
        <Pista>Pincha en el mapa donde va la ciudad.</Pista>
      )}
    </div>
  );
}
