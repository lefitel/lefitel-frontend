import { useContext, useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArchiveIcon, ChevronRightIcon, PencilIcon, SaveIcon, Undo2Icon } from "lucide-react";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { deleteTramo, editTramo, type CiudadDeRed, type TramoConCifras } from "../../../../api/Tramo.api";
import { mensajeDeError } from "../../../../api/descarga";
import type { Departamento } from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Combobox } from "../../../../components/ui/combobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../../components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../../components/ui/alert-dialog";
import { Aviso, BotonIcono, Campo, Encabezado, Pista } from "./panelUi";
import { useVivo } from "./useVivo";
import { useOcupado } from "./useOcupado";
import { nombreDeCiudad } from "../../../../lib/nombreDeCiudad";
import { NINGUNO, departamentoDeValor, valorDeDepartamento } from "./departamentoValor";
import { tramoEntre } from "./redEstado";
import TramoFotos from "../TramoFotos";

interface Props {
  tramo: TramoConCifras;
  /** Every live tramo: a pair of cities that is already one cannot be this one too. */
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  departamentos: Departamento[];
  /** Takes the selection off: what the card does once its tramo is archived. */
  onSeleccionar: (s: null) => void;
  recargar: () => Promise<void>;
  /** Whether a save is in flight, for the page to keep out of the way. */
  onOcupado: (ocupado: boolean) => void;
}

/** Why the two cities cannot be changed, said where they are; null when they can. */
function motivoDelBloqueo(postes: number | undefined): string | null {
  if (postes === 0) return null;
  // Without `postes.ver` the row does not say, so the tramo is treated as
  // having some: the server refuses the change if it does.
  if (postes === undefined) {
    return "Las ciudades de un tramo con postes no se pueden cambiar, y tu rol no ve si este los tiene.";
  }
  return `Tiene ${postes} ${postes === 1 ? "poste" : "postes"}: no se pueden cambiar sus ciudades.`;
}

/**
 * One tramo: its two cities, its department and, for whoever may, the things that
 * can be done to it. Everything that can be changed is changed here and saved
 * from the title's row — the cities as much as the department.
 *
 * The cities are only free on a tramo that has no poles: a pole belongs to its
 * tramo, and moving the tramo would move every one of them to another pair of
 * cities. With poles the two selectors show what is stored and say why.
 *
 * The panel mounts this keyed by the tramo's id, cities and department, so no
 * draft can outlive the tramo it was started on, nor a value that changed
 * elsewhere (a reload).
 */
export default function PanelTramo({
  tramo, tramos, ciudades, departamentos, onSeleccionar, recargar, onOcupado,
}: Props) {
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const puedeEditar = can(rol, "tramos", "editar");
  const puedeArchivar = can(rol, "tramos", "archivar");
  const puedeVerCiudad = can(rol, "ciudades", "ver");
  const puedeEditarCiudad = can(rol, "ciudades", "editar");

  const departamentoGuardado = valorDeDepartamento(tramo.id_departamento);
  const [departamento, setDepartamento] = useState(departamentoGuardado);
  const departamentoCambiado = departamento !== departamentoGuardado;

  const [idA, idB] = [String(tramo.ciudades[0].id), String(tramo.ciudades[1].id)];
  const [a, setA] = useState(idA);
  const [b, setB] = useState(idB);
  // A tramo has no direction: the same two the other way round is no change.
  const ciudadesCambiadas = !((a === idA && b === idB) || (a === idB && b === idA));
  const bloqueo = motivoDelBloqueo(tramo.postes);
  // The pair another live tramo already is. Said before the server has to.
  const ocupado = ciudadesCambiadas ? tramoEntre(tramos, Number(a), Number(b)) : undefined;

  const cambiado = departamentoCambiado || ciudadesCambiadas;
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  const vivo = useVivo();
  useOcupado(guardando || archivando, onOcupado);

  /** Back to what is saved, without leaving the card. */
  const descartar = () => {
    setA(idA);
    setB(idB);
    setDepartamento(departamentoGuardado);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      // Only what changed: a key that is sent is a key the server writes.
      await editTramo(tramo.id, {
        ...(departamentoCambiado ? { id_departamento: departamentoDeValor(departamento) } : {}),
        ...(ciudadesCambiadas ? { ciudades: [Number(a), Number(b)] as [number, number] } : {}),
      });
    } catch (error) {
      // The server's sentence when it has one: a pair held by an archived tramo,
      // or poles that arrived since this card was loaded, each say what to do.
      toast.error(mensajeDeError(error, ciudadesCambiadas ? "No se pudo guardar el tramo" : "No se pudo cambiar el departamento"));
      if (vivo.current) setGuardando(false);
      return;
    }
    toast.success(ciudadesCambiadas ? "Tramo actualizado" : "Departamento actualizado");
    // Off until the reload lands: until then the saved values are the old ones, and
    // the buttons would read "changed" again. The hook toasts a failed reload itself.
    await recargar().catch(() => undefined);
    if (vivo.current) setGuardando(false);
  };

  const archivar = async () => {
    setArchivando(true);
    try {
      await deleteTramo(tramo.id);
    } catch (error) {
      // The server's sentence: a tramo with poles says so, and that is the useful part.
      toast.error(mensajeDeError(error, "No se pudo archivar el tramo"));
      if (vivo.current) setArchivando(false);
      return;
    }
    // Archived: the selection goes first, the reload only refreshes the lists. The
    // selection is only cleared if this tramo is still the one on screen.
    toast.success("Tramo archivado");
    if (vivo.current) {
      setConfirmando(false);
      onSeleccionar(null);
    }
    void recargar();
  };

  // The tramo's own department is always on offer, even if the catalogue lacks it.
  const propio = tramo.departamento && !departamentos.some((d) => d.id === tramo.departamento!.id)
    ? [tramo.departamento] : [];

  // The same for its own two cities: an archived city still bounds a live
  // tramo, and a selector with no option for its value would show nothing.
  const archivadas = tramo.ciudades.filter((c) => !ciudades.some((x) => x.id === c.id));
  const opciones = [
    ...archivadas.map((c) => ({ value: String(c.id), label: `${nombreDeCiudad(c)} (archivada)` })),
    ...ciudades.map((c) => ({ value: String(c.id), label: nombreDeCiudad(c) })),
  ];
  const etiquetaDe = (id: string) => opciones.find((o) => o.value === id)?.label ?? `#${id}`;

  /** One end of the tramo: its selector, or its name, and the way into that city's card. */
  const ciudad = (valor: string, otra: string, cambiar: (v: string) => void, nombre: string) => {
    const viva = ciudades.find((c) => String(c.id) === valor);
    return (
      <Campo etiqueta="Ciudad">
        <div className="flex items-center gap-1.5">
          {puedeEditar ? (
            <Combobox
              ariaLabel={nombre}
              className="min-w-0 flex-1"
              disabled={bloqueo !== null || guardando}
              options={opciones.filter((o) => o.value !== otra)}
              value={valor}
              onValueChange={cambiar}
              placeholder="Elige una ciudad"
              searchPlaceholder="Buscar ciudad..."
            />
          ) : (
            <p className={`min-w-0 flex-1 truncate px-2.5 py-2 text-sm font-medium ${viva ? "" : "text-muted-foreground"}`}>
              {etiquetaDe(valor)}
            </p>
          )}
          {/* The city's own sheet, on the Ciudades screen: its name, its photo,
              where it stands are changed there and nowhere on this one. The
              selector beside it only says which city this end is. An archived
              city has no sheet to open, and neither has a role that may not
              read cities. */}
          {viva && puedeVerCiudad && (
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <Link
                to={`/app/ciudades/${viva.id}`}
                aria-label={`${puedeEditarCiudad ? "Editar ciudad" : "Ver ciudad"} ${nombreDeCiudad(viva)}`}
              >
                {puedeEditarCiudad ? <PencilIcon /> : <ChevronRightIcon />}
              </Link>
            </Button>
          )}
        </div>
      </Campo>
    );
  };

  return (
    <div className="space-y-3">
      {/* The photos of the two cities, as they are chosen in the card and not
          as they are saved. Pulled out to the edges of the panel's card, whose
          padding is `p-3` (`RedPage`): the two must change together. */}
      <div className="relative -mx-3 -mt-3">
        <TramoFotos ciudades={[ciudades.find((c) => String(c.id) === a), ciudades.find((c) => String(c.id) === b)]} />
        {/* Saving and discarding sit at the top of the card, over the photos,
            where the city's sheet has them: the same place on both for the
            same pair. Saving was on the title's row beside archiving.

            «Descartar» was taken out once, on the reasoning that leaving the
            card discards — it is mounted afresh the next time it is opened.
            Isaias asked for it back on 2026-10-13: the city's sheet has it,
            and undoing a change should not mean leaving and coming back. */}
        {puedeEditar && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5">
            <BotonIcono
              etiqueta="Descartar"
              variant="outline"
              className="shadow-sm"
              disabled={!cambiado || guardando}
              onClick={descartar}
            >
              <Undo2Icon />
            </BotonIcono>
            <BotonIcono
              etiqueta="Guardar"
              className="shadow-sm"
              disabled={!cambiado || !!ocupado || guardando}
              onClick={() => void guardar()}
            >
              <SaveIcon />
            </BotonIcono>
          </div>
        )}
      </div>

      {/* Archiving stays on the title's row, as an icon: the row is 384px wide
          and the title needs most of it. */}
      <Encabezado
        rotulo="Tramo"
        titulo={tramo.nombre}
        accion={puedeArchivar && (
          <BotonIcono
            etiqueta="Archivar"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={guardando}
            onClick={() => setConfirmando(true)}
          >
            <ArchiveIcon />
          </BotonIcono>
        )}
      />

      {ciudad(a, b, setA, "Ciudad")}
      {ciudad(b, a, setB, "Otra ciudad")}

      {puedeEditar && bloqueo && <Pista>{bloqueo}</Pista>}
      {ocupado && (
        <Aviso>
          Ese tramo ya existe: {ocupado.nombre}.
        </Aviso>
      )}

      <Campo etiqueta="Departamento">
        {puedeEditar ? (
          <Select value={departamento} onValueChange={setDepartamento} disabled={guardando}>
            <SelectTrigger aria-label="Departamento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NINGUNO}>Sin departamento</SelectItem>
              {[...propio, ...departamentos].map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className={`text-sm font-medium ${tramo.departamento ? "" : "text-muted-foreground"}`}>
            {tramo.departamento?.name ?? "Sin departamento"}
          </p>
        )}
      </Campo>

      {/* Not when the note above already gave the figure — «Tiene 22 postes: no
          se pueden cambiar…» — which is whenever an editor looks at a tramo
          that has poles. It stays where that note is not drawn: a tramo with
          none, and a role that cannot edit and so is told nothing about a lock. */}
      {tramo.postes !== undefined && !(puedeEditar && bloqueo) && (
        <p className="text-sm">
          <span className="font-semibold tabular-nums">{tramo.postes}</span>{" "}
          {tramo.postes === 1 ? "poste" : "postes"} en este tramo
        </p>
      )}

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar tramo?</AlertDialogTitle>
            <AlertDialogDescription>
              El tramo <strong>{tramo.nombre}</strong> quedará archivado y dejará de aparecer en las listas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              disabled={archivando}
              // Not closed by the action itself: a refusal keeps the dialog and the tramo.
              onClick={(e) => { e.preventDefault(); void archivar(); }}
            >
              {archivando ? "Archivando..." : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
