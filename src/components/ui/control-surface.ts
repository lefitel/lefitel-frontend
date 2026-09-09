/**
 * The skin every form control in this application wears.
 *
 * Filled and lit rather than outlined: `--gradient-secondary` for the light
 * falling across it and `elevation-control` for the highlight along the top
 * edge and the shadow under the bottom one — the lighting of a `secondary`
 * button, deliberately, because these stand beside buttons far more often than
 * beside each other.
 *
 * `elevation-control` is a utility and not `shadow-[var(--x)]`: Tailwind 4
 * swallows a multi-layer shadow written inline, silently.
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
 * And the inset highlight does not make up the difference: 1.08:1 in the light
 * theme (invisible) and 2.44:1 in the dark one. A disabled field, at
 * `opacity-50` over a card, reaches 1.08:1 in the light theme.
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
  "rounded-md border border-transparent bg-[image:var(--gradient-secondary)] " +
  "outline-none elevation-control " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring " +
  "aria-invalid:border-destructive aria-invalid:outline-destructive " +
  "disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The same skin, plus what a control that *opens something* also needs: the
 * row that holds a label against a chevron, and a hover.
 *
 * Hover belongs here and not in `controlSurface`. A dropdown lights up under
 * the pointer because clicking it is the whole of its purpose; a text field
 * that did the same would be answering a mouse that is only passing over on
 * its way to the caret. Swapping one gradient for another rather than dropping
 * to a flat colour is what keeps the lighting from blinking off — a gradient
 * cannot interpolate.
 *
 * Callers override with `cn(chooserTrigger, "h-8 flex-1", className)`; height
 * and width are the only things any of them has ever needed to change.
 */
export const chooserTrigger =
  controlSurface +
  " flex h-9 w-full items-center justify-between gap-2 px-3 py-1 text-sm " +
  "whitespace-nowrap transition-colors hover:bg-[image:var(--gradient-accent)]";

/**
 * How a caller takes the surface back off, for the handful of places that need
 * a field with no chrome at all: the rename box inside a column pill, the
 * search line in the field picker, the latitude and longitude over a map.
 *
 * It has to be spelled exactly like this, and that is worth knowing before
 * writing `bg-transparent` and assuming it worked:
 *
 * - **`bg-none`, not `bg-transparent`.** The fill is a `background-image`, and
 *   a `background-color` does not cancel one — it paints behind it. Nor does
 *   `cn` help: tailwind-merge files the two in different groups, sees no
 *   conflict, and keeps both. `bg-none` is the only class in the same group,
 *   so it is the only one that replaces it.
 * - **`shadow-none!`, with the bang.** `elevation-control` is a custom
 *   `@utility`, which Tailwind 4 emits *after* the built-in shadows; at equal
 *   specificity the later rule wins, so a plain `shadow-none` loses. The
 *   important flag is what settles it.
 *
 * Six call sites had `bg-transparent shadow-none border-0` on them and were
 * quietly getting a filled, shadowed box instead — including, in the same
 * commit that introduced this surface, the rename field inside a pill that had
 * just been made transparent so it would paint nothing.
 */
export const flatControl = "bg-none shadow-none! border-0";
