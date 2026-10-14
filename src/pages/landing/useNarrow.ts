import { useEffect, useState } from "react";

const QUERY = "(max-width: 639px)";

/**
 * True below the small breakpoint, where a drawing has to be framed
 * differently rather than just shrunk: the hero plan crops to four poles, and
 * the pole card moves the camera so the pole is not under the full-width card.
 */
export function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(QUERY);
    setNarrow(list.matches);
    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, []);

  return narrow;
}
