import { useLayoutEffect, useRef } from "react";

/**
 * A ref that always holds the value of the latest committed render.
 *
 * For callbacks that must keep the same identity across renders â€” handed to a
 * memoised child, listed in an effect's dependencies, called from a timer â€”
 * and still read current values: they read `ref.current` when they run
 * instead of closing over the value of the render that created them.
 *
 * The ref is updated in a layout effect, not during render: React may render
 * and then throw the render away (a transition interrupted, a Suspense
 * fallback), and a write made during render would leave the ref holding a
 * value that never reached the screen. A layout effect runs in the commit,
 * before the browser paints and before any `useEffect` of that same commit,
 * so an effect, an event handler or a timer callback always sees the value it
 * was rendered with. Initialised with `value` so the very first render already
 * reads it.
 *
 * The returned ref never changes identity, so listing it in a dependency array
 * costs nothing — the lint rule cannot know that, and asks for it.
 *
 * Read `ref.current` only from effects and handlers, never while rendering:
 * during render it still holds the previous commit's value, so render code
 * should use the value itself.
 */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
