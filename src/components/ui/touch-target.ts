/**
 * A bigger place to press, for a control drawn smaller than a finger.
 *
 * Some controls are small on purpose — a 14px info icon beside a label, a 16px
 * checkbox in a table row — and growing them would change the layout they sit
 * in. This grows only what can be pressed: an invisible square 10px past each
 * edge, drawn by `::after` over the control, so nothing moves.
 *
 * Only for a coarse pointer. A mouse hits a 14px icon fine, and there the
 * enlarged square would sit over the neighbours and take their clicks.
 *
 * The control must not already use `::after`, and needs no `position` of its
 * own: this gives it `relative`.
 */
export const touchTarget =
  "relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2.5 pointer-coarse:after:content-['']";
