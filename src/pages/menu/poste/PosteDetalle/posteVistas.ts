/** What the pole's panel can show; the rail beside it chooses one. */
export type VistaPoste = "resumen" | "resueltos" | "vecinos" | "bitacora";

// The ids that tie each tab on the rail to the panel it fills.
export const vistaTabId = (vista: VistaPoste) => `poste-vista-tab-${vista}`;
export const VISTA_PANEL_ID = "poste-vista-panel";
