import { useContext, useState } from "react";
import { toast } from "sonner";
import { SaveIcon } from "lucide-react";
import { createTramo, tramoDelConflicto, type CiudadDeRed, type TramoConCifras } from "../../../../api/Tramo.api";
import { mensajeDeError } from "../../../../api/descarga";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import type { Departamento } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Combobox } from "../../../../components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import { tramoEntre, type Accion, type EstadoRed } from "./redEstado";
import { Aviso, BotonIcono, Campo, Encabezado, Pista } from "./panelUi";
import { useVivo } from "./useVivo";
import { useOcupado } from "./useOcupado";
import { nombreDeCiudad } from "../../../../lib/nombreDeCiudad";
import { NINGUNO, departamentoDeValor } from "./departamentoValor";

interface Props {
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  departamentos: Departamento[];
  estado: EstadoRed;
  despachar: (a: Accion) => void;
  onSeleccionar: (s: { tramo: number } | null) => void;
  recargar: () => Promise<void>;
  /** Whether a save is in flight, for the page to keep out of the way. */
  onOcupado: (ocupado: boolean) => void;
}

/** Two cities and an optional department. Nothing is stored until «Guardar tramo». */
export default function PanelTramoNuevo({
  tramos, ciudades, departamentos, estado, despachar, onSeleccionar, recargar, onOcupado,
}: Props) {
  const { sesion } = useContext(SesionContext);
  const puedeCrearCiudad = can(sesion.usuario.id_rol, "ciudades", "crear");
  const [departamento, setDepartamento] = useState(NINGUNO);
  const [guardando, setGuardando] = useState(false);
  const vivo = useVivo();
  useOcupado(guardando, onOcupado);

  // `elegidas` is a compact list: its first entry fills the first selector and its
  // second the second, whichever slot was set last.
  const [a, b] = [estado.elegidas[0] ?? null, estado.elegidas[1] ?? null];
  const nombreDe = (id: number) => nombreDeCiudad(ciudades.find((c) => c.id === id) ?? { id });
  const opciones = ciudades.map((c) => ({ value: String(c.id), label: nombreDeCiudad(c) }));

  const existente = a !== null && b !== null ? tramoEntre(tramos, a, b) : undefined;
  // Provisional: the server names the tramo when it is stored. The two names are
  // ordered with `<` only so the title does not depend on the order they were picked.
  const titulo = a !== null && b !== null
    ? [nombreDe(a), nombreDe(b)].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)).join(" – ")
    : "Elige dos ciudades";

  const terminar = () => despachar({ tipo: "terminar" });

  const abrir = (id: number) => {
    terminar();
    onSeleccionar({ tramo: id });
  };
  // The same, for an answer that arrives after a save: only if this view is still
  // the one on screen, so a late answer cannot act on whatever the person does now.
  const abrirSiSigue = (id: number) => { if (vivo.current) abrir(id); };

  const guardar = async () => {
    if (a === null || b === null) return;
    const id_departamento = departamentoDeValor(departamento);
    setGuardando(true);
    let creado: { id: number };
    try {
      creado = await createTramo({
        ciudades: [a, b],
        // No key at all when there is none: a new tramo has no department to clear.
        ...(id_departamento === null ? {} : { id_departamento }),
      });
    } catch (error) {
      const delPar = tramoDelConflicto(error);
      if (delPar && !delPar.archivado) {
        // Not a failure: the pair is there, which is what was being looked for. A live
        // 409 only arrives for a tramo this screen has not loaded, so it is reloaded
        // after it is selected (the page keeps an unknown id while it reloads).
        toast.info(`Ese tramo ya existía: ${delPar.nombre}`);
        abrirSiSigue(delPar.id);
        void recargar();
        return;
      }
      if (delPar) toast.error("Ese tramo existe archivado. Recupéralo en Archivados.");
      else toast.error(mensajeDeError(error, "No se pudo crear el tramo"));
      if (vivo.current) setGuardando(false);
      return;
    }
    // Saved: the buttons stay off until the view is left, so a second press cannot
    // create a second tramo. The reload only refills the lists; until the new tramo
    // is in them the card shows the list.
    toast.success("Tramo creado");
    abrirSiSigue(creado.id);
    void recargar();
  };

  return (
    <div className="space-y-3">
      {/* The card's two buttons sit on the title's row, where the list has
          «Añadir tramo»: the place the hand just pressed, and the same place
          in every card of the panel. Saving is the icon it is in all of them;
          «Cancelar» stays a word, because this card has no back arrow and it
          is the only way out. */}
      <Encabezado
        rotulo="Tramo nuevo"
        titulo={titulo}
        accion={(
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" disabled={guardando} onClick={terminar}>Cancelar</Button>
            <BotonIcono
              etiqueta="Guardar tramo"
              disabled={a === null || b === null || !!existente || guardando}
              onClick={() => void guardar()}
            >
              <SaveIcon />
            </BotonIcono>
          </div>
        )}
      />

      <Campo etiqueta="Ciudad">
        <Combobox
          ariaLabel="Ciudad"
          disabled={guardando}
          options={opciones.filter((o) => o.value !== String(b))}
          value={a === null ? "" : String(a)}
          onValueChange={(v) => despachar({ tipo: "fijar", hueco: 0, id: Number(v) })}
          placeholder="Elige o pincha en el mapa"
          searchPlaceholder="Buscar ciudad..."
        />
      </Campo>
      <Campo etiqueta="Ciudad">
        <Combobox
          ariaLabel="Otra ciudad"
          disabled={guardando}
          options={opciones.filter((o) => o.value !== String(a))}
          value={b === null ? "" : String(b)}
          onValueChange={(v) => despachar({ tipo: "fijar", hueco: 1, id: Number(v) })}
          placeholder="Elige o pincha en el mapa"
          searchPlaceholder="Buscar ciudad..."
        />
      </Campo>

      <Campo etiqueta="Departamento">
        <Select value={departamento} onValueChange={setDepartamento} disabled={guardando}>
          <SelectTrigger aria-label="Departamento">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NINGUNO}>Sin departamento</SelectItem>
            {departamentos.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Campo>

      {existente && (
        <Aviso>
          Ese tramo ya existe.{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={() => abrir(existente.id)}
          >
            Abrirlo
          </button>
        </Aviso>
      )}

      <Pista>No hay orden: da igual cuál elijas primero.</Pista>

      {/* The only way to make a city from this screen, and it is here because
          this is where one is found to be missing. What is picked so far waits. */}
      {puedeCrearCiudad && (
        <Pista>
          ¿Falta una ciudad?{" "}
          <button
            type="button"
            disabled={guardando}
            className="text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
            onClick={() => despachar({ tipo: "ciudadParaTramo" })}
          >
            Crear ciudad
          </button>
        </Pista>
      )}

    </div>
  );
}
