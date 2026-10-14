import { useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { HeaderSlotContext, type HeaderSlots } from "./headerSlotContext";

/**
 * The app's header belongs, beside its trail, to whichever screen is open.
 *
 * A list screen no longer has a title row of its own — the trail in the header
 * already says where you are — so the controls that used to sit beside that
 * title (the Activos/Archivados tabs, a page-level button) are drawn up there
 * instead. The screen still owns them: they are rendered from inside it, so
 * they keep its state and its context, and only their place in the document
 * changes.
 *
 * Two places, one on each side of the trail:
 *
 * - `end`, the right-hand side: what the screen chooses between or does.
 * - `start`, between the sidebar's button and the trail: the way back out of
 *   where the trail says you are, which reads as part of the trail.
 *
 * The header has room for one 32px row. What goes in here is sized for it:
 * `size="sm"` on a `TabsList` or a `Button`, `icon-sm` on an icon.
 *
 * The context and its provider live in `headerSlotContext.ts`.
 *
 * Outside the shell there is no header to draw into, and the controls are
 * rendered where they are written. That is what a screen mounted on its own
 * gets — which is every screen's own test.
 *
 * Inside the shell but before its header exists — the first render, one frame
 * long — nothing is drawn at all. Falling back to "where they are written"
 * there would flash the controls in the page and then move them.
 */
export function HeaderSlot({ children, side = "end" }: { children: ReactNode; side?: keyof HeaderSlots }) {
  const slots = useContext(HeaderSlotContext);
  if (slots === undefined) return <>{children}</>;
  const target = slots[side];
  return target ? createPortal(children, target) : null;
}
