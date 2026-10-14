import { useState } from "react";
import type { CiudadDeRed, TramoConCifras } from "../../../../api/Tramo.api";
import type { Departamento, PosteInterface } from "../../../../interfaces/interfaces";
import type { Accion, EstadoRed } from "./redEstado";
import PanelLista from "./PanelLista";
import type { FiltrosLista } from "./filtrosLista";
import PanelTramo from "./PanelTramo";
import { PanelTramoBitacora, PanelTramoPendientes, PanelTramoPostes } from "./PanelTramoVistas";
import type { VistaTramo } from "./tramoVistas";
import PanelTramoNuevo from "./PanelTramoNuevo";
import PanelCiudadNueva from "./PanelCiudadNueva";

export interface RedPanelProps {
  tramos: TramoConCifras[];
  ciudades: CiudadDeRed[];
  departamentos: Departamento[];
  tramoSel: number | null;
  estado: EstadoRed;
  despachar: (a: Accion) => void;
  /** null clears the selection and shows the list. */
  onSeleccionar: (s: { tramo: number } | { ciudad: number } | null) => void;
  recargar: () => Promise<void>;
  /** Whether the card has a save in flight. */
  onOcupado: (ocupado: boolean) => void;
  /** The list's filters. The page's, because the map follows the department one. */
  filtros: FiltrosLista;
  setFiltros: (f: FiltrosLista) => void;
  /** Starts a new tramo, from the list. Absent for a role that may not create one. */
  onNuevoTramo?: () => void;
  /**
   * Whether the selected tramo's card is open. A tramo can be selected without
   * it: marked in the list and drawn on the map, and no more.
   */
  detalle: boolean;
  /** Which of the open card's views is on: the rail beside the card chooses. */
  vista: VistaTramo;
  /** The selected tramo's poles, which the page loads for the map, and whether they are still on their way. */
  postes: PosteInterface[];
  cargandoPostes: boolean;
  /** Opens that tramo's card, selecting it if it was not. Closing it is the page's: the way back is in the app's header. */
  onDetalle: (tramo: number) => void;
}

/**
 * The content of the card at the right of the network map: what is selected, and
 * where everything is saved. The card around it and its width are the page's.
 *
 * One view at a time, in this order: a new tramo, the city a new tramo lacks, the
 * selected tramo's card if it was opened, the list of tramos. A city has no view
 * here: pressed on the map, it opens a card that floats over it (`CiudadFlotante`). A selection the loaded data does not hold (just
 * archived, not yet reloaded) shows the list rather than an empty card.
 */
export default function RedPanel({
  tramos, ciudades, departamentos, tramoSel, estado, despachar, onSeleccionar, recargar, onOcupado,
  filtros, setFiltros, onNuevoTramo, detalle, onDetalle, vista, postes, cargandoPostes,
}: RedPanelProps) {
  // Kept here, not in the list: coming back from a tramo finds what was typed.
  const [busqueda, setBusqueda] = useState("");

  if (estado.modo === "tramoNuevo") {
    return (
      <PanelTramoNuevo
        tramos={tramos} ciudades={ciudades} departamentos={departamentos} estado={estado}
        despachar={despachar} onSeleccionar={onSeleccionar} recargar={recargar} onOcupado={onOcupado}
      />
    );
  }
  if (estado.modo === "ciudadNueva") {
    return (
      <PanelCiudadNueva
        ciudades={ciudades} estado={estado} despachar={despachar}
        recargar={recargar} onOcupado={onOcupado}
      />
    );
  }

  const tramo = tramoSel === null ? undefined : tramos.find((t) => t.id === tramoSel);
  if (tramo && detalle) {
    // The summary is the card as it always was; each of the others takes the
    // whole card, with the same header, so the lists have room.
    if (vista === "postes") return <PanelTramoPostes tramo={tramo} postes={postes} cargando={cargandoPostes} />;
    // Keyed by the tramo: another tramo's list is asked for afresh, not shown stale.
    if (vista === "pendientes") return <PanelTramoPendientes key={tramo.id} tramo={tramo} />;
    if (vista === "bitacora") return <PanelTramoBitacora tramo={tramo} />;
    return (
      <PanelTramo
        // The department and the two cities are part of the key: a draft started on
        // the old ones is dropped when a save or a reload brings new ones.
        key={`${tramo.id}-${tramo.id_departamento ?? "ninguno"}-${tramo.ciudades.map((c) => c.id).join("-")}`}
        tramo={tramo} tramos={tramos} ciudades={ciudades} departamentos={departamentos}
        onSeleccionar={onSeleccionar}
        recargar={recargar} onOcupado={onOcupado}
      />
    );
  }

  return (
    <PanelLista
      tramos={tramos} tramoSel={tramoSel} busqueda={busqueda} setBusqueda={setBusqueda}
      filtros={filtros} setFiltros={setFiltros} onSeleccionar={onSeleccionar}
      onDetalle={onDetalle} onNuevoTramo={onNuevoTramo}
    />
  );
}
