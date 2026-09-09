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
 * **What this costs, so that it is on the record.** A select says "I am a
 * control" with its chevron; a text field had only its border, and now has
 * nothing but the fill. Isaias chose that on 2026-09-08, over the alternative
 * of leaving `Input` and `Textarea` outlined so that "you choose from these,
 * you type in those" stayed legible at a glance. If somebody starts reading
 * past a field without noticing it can be typed in, this is the line to come
 * back to.
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
