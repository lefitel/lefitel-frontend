/** A panel that opens under its row: what a section with a list needs. */
export interface PanelDeFila {
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
}

/**
 * What the profile hands a section so it can live as one row of "Acceso y
 * seguridad" instead of as a card of its own.
 *
 * Nothing here about drafts, on purpose: every form a section has is a modal
 * dialog, so nothing is ever half typed while a panel could be closed.
 *
 * `panel` is only for the section whose row has something to list. The others
 * put their buttons on the row itself (`accionesFila`) and need no state.
 */
export interface FilaDePerfil {
  panel?: PanelDeFila;
}

/** A row whose buttons sit on the row itself: there is no panel to keep. */
export const FILA_SIN_PANEL: FilaDePerfil = {};
