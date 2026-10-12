import { useEffect, useState } from "react";

/**
 * Whether an element is at least `minWidth` pixels wide, kept up to date.
 *
 * For layout decisions CSS cannot make because they change what is computed,
 * not how it is drawn — how many points a chart is cut into, say. The element
 * is observed rather than the window: a sidebar opening narrows the content
 * without the viewport moving, and a media query would never hear of it.
 *
 * The answer is a boolean on purpose. A resize passes through hundreds of
 * widths and only one of them changes the answer; keeping the width itself in
 * state would re-render the caller for every one.
 *
 * @returns A ref to attach to the element, and the answer — `false` until the
 *   element has been measured, so the narrow layout is the one drawn first.
 */
export function useIsWiderThan<T extends HTMLElement = HTMLElement>(
  minWidth: number,
): [(node: T | null) => void, boolean] {
  // A callback ref held in state, not `useRef`: the element may mount later
  // than the caller does, and an effect keyed on a ref object would not rerun.
  const [node, setNode] = useState<T | null>(null);
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWide(entry.contentRect.width >= minWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, minWidth]);

  return [setNode, wide];
}
