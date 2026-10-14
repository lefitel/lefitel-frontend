/**
 * The skin every form control in this application wears.
 *
 * Filled rather than outlined, and flat: `--secondary`, with no light across
 * it and no shadow under it. It was lit until 2026-10-13 — a gradient and a
 * raised edge, the lighting of the buttons it stands beside — and went flat
 * the day the buttons did, on Isaias's choice from a mock-up of three
 * options. The fill is the same grey it was; only the relief is gone.
 *
 * The border stays in the box model, transparent. The invalid state needs
 * something to paint red, and turning it on must not move anything by a pixel.
 *
 * **What this costs, measured, so that it is on the record.**
 *
 * `--input` exists to carry 3:1 — it is written into `index.css` beside the
 * token: "`--border` is decorative; `--input` outlines a control the user must
 * find, so it carries the 3:1 the border does not need." This surface removes
 * that outline from every control and replaces it with a fill:
 *
 * | where | old `--input` border | this fill |
 * |---|---|---|
 * | light, on `--card` | 3.33:1 | **1.17:1** |
 * | light, in a Sheet (`--background`) | 3.11:1 | **1.09:1** |
 * | dark, on `--card` | 3.29:1 | **1.20:1** |
 *
 * Those were measured on the lit skin. Flat, the fill alone is 1.17:1 on a
 * light card and 1.11:1 on a dark one, and the soft shadow that helped the eye
 * find it is no longer there. A disabled field, at `opacity-50` over a card,
 * reaches 1.08:1 in the light theme.
 *
 * That is a concrete failure of WCAG 2.1 SC 1.4.11 across roughly 125 call
 * sites, and it lands hardest on the seven Sheet panels — 28 fields for
 * creating a poste, a ciudad, a usuario, an evento.
 *
 * **Isaias was told the measurement and chose to keep it on 2026-09-08.** He
 * had first chosen it on the strength of my claim that the fill and the
 * lighting carried the control; that claim was wrong in the light theme, and
 * he kept the decision anyway with the numbers in front of him. A select still
 * says "I am a control" with its chevron. A text field now says it with a fill
 * of 1.17:1 and nothing else. If somebody starts reading past a field without
 * noticing it can be typed in, this is the line to come back to, and the fix
 * is to give `Input` and `Textarea` their border back.
 *
 * There was one skin written out by hand in five places before this — the
 * select, the searchable combobox, the list picker, the date picker and a
 * page-local constant in the bitácora — and they had already drifted apart,
 * three of them still wearing `border-input bg-background shadow-sm` after the
 * select had stopped.
 */
export const controlSurface =
  "rounded-md border border-transparent bg-secondary " +
  "outline-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring " +
  "aria-invalid:border-destructive aria-invalid:outline-destructive " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The same skin, plus what a control that *opens something* also needs: the
 * row that holds a label against a chevron, and a hover.
 *
 * Hover belongs here and not in `controlSurface`. A dropdown darkens under
 * the pointer because clicking it is the whole of its purpose; a text field
 * that did the same would be answering a mouse that is only passing over on
 * its way to the caret.
 *
 * Callers override with `cn(chooserTrigger, "h-8 flex-1", className)`; height
 * and width are the only things any of them has ever needed to change.
 */
export const chooserTrigger =
  controlSurface +
  " flex h-9 w-full items-center justify-between gap-2 px-3 py-1 text-sm " +
  "whitespace-nowrap transition-colors hover:bg-accent";

/**
 * How a caller takes the surface back off, for the handful of places that need
 * a field with no chrome at all: the rename box inside a column pill, the
 * search line in the field picker, the latitude and longitude over a map.
 *
 * Through `cn`, which is what makes it work: the fill is a background colour
 * now, so `bg-transparent` is in its group and tailwind-merge drops the fill
 * for it. It could not while the fill was a gradient — a `background-image`,
 * which a colour paints behind — and this was spelled `bg-none shadow-none!`
 * then. Six call sites had `bg-transparent shadow-none border-0` written by
 * hand and were quietly getting a filled, shadowed box; keep going through
 * this constant, so that the next change of skin is made in one place again.
 */
export const flatControl = "bg-transparent border-0";
