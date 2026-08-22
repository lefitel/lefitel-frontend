import { useEffect, useRef } from "react";

/**
 * Dissolve a bottom fade as the last of a scroller's content comes into view.
 *
 * A box that clips its overflow cuts straight across whatever sits on the
 * fold, and a half-drawn table row reads as a rendering fault. A gradient
 * softens that edge — but a gradient that is simply always on parks a wash of
 * background colour over the last thing on the page, which on every table
 * screen here is the pagination bar. Greyed-out arrows that still work are
 * worse than the hard edge we set out to fix, so the fade has to be gone by
 * the time the reader reaches the end.
 *
 * Opacity is therefore read from the scroll position rather than played over a
 * duration: solid while more than a fade's worth of content remains below,
 * winding down to nothing as those last pixels arrive. Tied to the scroll and
 * not to a clock, it cannot lag behind the finger or keep animating after the
 * moment has passed.
 *
 * The value is written straight to the node. Routing it through `useState`
 * would re-render everything the scroller contains on every scroll event, to
 * repaint one gradient.
 *
 * @param resetKey Changes whenever the scroller is handed new content — a
 *   route path, say. The listeners are rebuilt so nothing keeps measuring the
 *   page the reader already left.
 * @returns Refs to attach: `scroller` on the element that owns the overflow,
 *   `fade` on the gradient. The fade must sit OUTSIDE the scroller, or it
 *   scrolls away with the content it is meant to cover. Its rendered height is
 *   the ramp the opacity is measured against, so the size stays decided in one
 *   place — the stylesheet.
 */
export function useScrollFade<
  S extends HTMLElement = HTMLElement,
  F extends HTMLElement = HTMLElement,
>(resetKey: string) {
  const scroller = useRef<S>(null);
  const fade = useRef<F>(null);

  useEffect(() => {
    const box = scroller.current;
    const veil = fade.current;
    if (!box || !veil) return;

    let previous = -1;
    const update = () => {
      const below = box.scrollHeight - box.scrollTop - box.clientHeight;
      const next = Math.min(1, Math.max(0, below / (veil.offsetHeight || 1)));
      // Sub-percent steps are invisible; skipping them keeps a fast scroll from
      // touching the DOM on every event.
      if (Math.abs(next - previous) < 0.01) return;
      previous = next;
      veil.style.opacity = String(next);
    };

    box.addEventListener("scroll", update, { passive: true });

    // Content that grows without anyone scrolling — a table arriving from the
    // API, a filter dropping rows — moves the end of the page out from under a
    // fade that would otherwise keep the reading it took on an empty screen.
    const resized = new ResizeObserver(update);
    const watch = () => {
      resized.disconnect();
      resized.observe(box);
      if (box.firstElementChild) resized.observe(box.firstElementChild);
      update();
    };

    // Screens that swap their root element between loading and loaded states
    // hand us a different child, and the old one stops reporting its size the
    // moment it is detached.
    const replaced = new MutationObserver(watch);
    replaced.observe(box, { childList: true });
    watch();

    return () => {
      box.removeEventListener("scroll", update);
      resized.disconnect();
      replaced.disconnect();
    };
  }, [resetKey]);

  return { scroller, fade };
}
