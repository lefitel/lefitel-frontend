import { AlertCircleIcon, HistoryIcon, LayoutListIcon, UtilityPoleIcon } from "lucide-react";
import PanelRail, { type PanelRailItem } from "../../../../components/PanelRail";
import { VISTA_PANEL_ID, vistaTabId, type VistaTramo } from "./tramoVistas";

interface Props {
  vista: VistaTramo;
  onVista: (vista: VistaTramo) => void;
  /** Whether this role may read poles (`postes.ver`). Without it there is no list of them to offer. */
  canVerPostes: boolean;
  /** Whether this role may read incidents (`eventos.ver`). */
  canVerEventos: boolean;
  /**
   * Whether this role may read the audit log (`bitacora.ver`). Not offered
   * without it: the log's own endpoint asks for that permission, and a view
   * whose only content is "no tiene permiso" is not a view.
   */
  canVerBitacora: boolean;
  /** The figures the tramo's row carries; absent when the role may not read them. */
  postes?: number;
  pendientes?: number;
}

/**
 * The strip beside a tramo's card that chooses what the card shows: the same
 * one the pole's sheet and the incident's have.
 *
 * The short things — the two cities, the department — are the summary. The
 * lists each get the whole card to themselves: a tramo can hold a hundred and
 * forty poles, and under the summary they would push it out of sight.
 */
export default function TramoRail({
  vista, onVista, canVerPostes, canVerEventos, canVerBitacora, postes, pendientes,
}: Props) {
  const items: PanelRailItem<VistaTramo>[] = [
    { value: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    ...(canVerPostes
      ? [{ value: "postes" as const, label: "Postes", icon: <UtilityPoleIcon />, count: postes }]
      : []),
    ...(canVerEventos
      ? [{ value: "pendientes" as const, label: "Eventos pendientes", short: "Pendientes", icon: <AlertCircleIcon />, count: pendientes }]
      : []),
    ...(canVerBitacora
      ? [{ value: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  return (
    <PanelRail
      label="Vistas del tramo"
      items={items}
      value={vista}
      onChange={onVista}
      panelId={VISTA_PANEL_ID}
      tabId={vistaTabId}
    />
  );
}
