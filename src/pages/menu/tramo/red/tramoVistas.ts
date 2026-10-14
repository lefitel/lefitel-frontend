/** What a tramo's card can show; the rail beside it chooses one. */
export type VistaTramo = "resumen" | "postes" | "pendientes" | "bitacora";

// The ids that tie each tab on the rail to the card it fills.
export const vistaTabId = (vista: VistaTramo) => `tramo-vista-tab-${vista}`;
export const VISTA_PANEL_ID = "tramo-vista-panel";
