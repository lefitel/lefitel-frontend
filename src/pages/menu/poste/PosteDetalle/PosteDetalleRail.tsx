import { CheckCircle2Icon, HistoryIcon, LayoutListIcon, RouteIcon } from "lucide-react";
import PanelRail, { type PanelRailItem } from "../../../../components/PanelRail";
import { VISTA_PANEL_ID, vistaTabId, type VistaPoste } from "./posteVistas";

interface Props {
  vista: VistaPoste;
  onVista: (vista: VistaPoste) => void;
  /**
   * Whether this role may see incidents (`eventos.ver`). Without it there is no
   * "Resueltos" view — the sheet never asked for them.
   */
  canVerEventos: boolean;
  /**
   * Whether this role may read the audit log (`bitacora.ver`). The view is not
   * offered without it: the log's own endpoint asks for that permission, so the
   * seeded Coordinador and Cliente roles were shown a section whose only
   * content was "No tiene permiso para ver la bitácora".
   */
  canVerBitacora: boolean;
  resueltos: number;
  vecinos: number;
}

/**
 * The strip beside the pole's panel that chooses what the panel shows.
 *
 * The short things — the pole, its open incidents, its record — share one
 * view. The long lists each get the whole panel to themselves: folded into the
 * same column, opening forty neighbours pushed everything else out of sight.
 */
export default function PosteDetalleRail({
  vista, onVista, canVerEventos, canVerBitacora, resueltos, vecinos,
}: Props) {
  const items: PanelRailItem<VistaPoste>[] = [
    { value: "resumen", label: "Resumen", icon: <LayoutListIcon /> },
    ...(canVerEventos
      ? [{ value: "resueltos" as const, label: "Resueltos", icon: <CheckCircle2Icon />, count: resueltos }]
      : []),
    { value: "vecinos", label: "Vecinos", icon: <RouteIcon />, count: vecinos },
    ...(canVerBitacora
      ? [{ value: "bitacora" as const, label: "Bitácora", icon: <HistoryIcon /> }]
      : []),
  ];

  return (
    <PanelRail
      label="Vistas del poste"
      items={items}
      value={vista}
      onChange={onVista}
      panelId={VISTA_PANEL_ID}
      tabId={vistaTabId}
    />
  );
}
