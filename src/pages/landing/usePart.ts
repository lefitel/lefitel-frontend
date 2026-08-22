import { useRef } from "react";
import { useInView } from "motion/react";
import { beatsOf, type Script } from "./scripts";
import { usePrefersReducedMotion, useTimeline } from "./useTimeline";

/**
 * One piece of the showcase, wired to the scrollbar.
 *
 * A piece stays still until it has scrolled into view, then runs its script
 * once and holds the last frame. Once, not on a loop: eleven things looping on
 * one page is a fairground. And once means scrolling back up does not restage
 * everything the reader has already watched.
 *
 * The bottom margin makes a piece wait until it is properly on screen rather
 * than firing the moment its first pixel appears, which on a fast flick would
 * mean the whole section animating somewhere above the fold.
 */
export function usePart<T extends HTMLElement = HTMLDivElement>(script: Script) {
  const ref = useRef<T>(null);
  const onScreen = useInView(ref, { once: true, margin: "0px 0px -18% 0px" });
  const still = usePrefersReducedMotion();

  const step = useTimeline({
    beats: beatsOf(script),
    duration: script.duration,
    playing: onScreen,
    still,
    stillStep: script.stillStep,
  });

  return { ref, step, still, onScreen };
}
