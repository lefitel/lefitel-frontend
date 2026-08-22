import { useEffect, useRef, useState } from "react";

/**
 * The clock every showcase scene runs on.
 *
 * A scene is a short scripted demo: a cursor picks a poste, a form fills
 * itself, a report exports. Written as one long imperative animation it would
 * be unpausable and unrewindable, and every pointer entering the frame would
 * leave orphaned timers behind. So a scene is instead a list of *beats* — the
 * millisecond each step begins — and this hook says which step we are on.
 * Everything visible derives from that number, which makes pausing nothing more
 * than not scheduling the next one.
 *
 * The hook wakes only at boundaries, roughly ten times per scene, never per
 * frame. The progress bar under the tabs is a CSS animation for the same
 * reason: sixty React renders a second to move one stripe is not a trade worth
 * making on a page whose whole job is to look effortless.
 */

/** Milliseconds at which each step begins. Must start at 0 and ascend. */
export type Beats = readonly number[];

/** Which step a clock reading of `elapsed` falls in. */
export function stepAt(beats: Beats, elapsed: number): number {
  let step = 0;
  for (let i = 1; i < beats.length; i++) {
    if (elapsed >= (beats[i] ?? Infinity)) step = i;
    else break;
  }
  return step;
}

interface TimelineArgs {
  beats: Beats;
  /** Total length of the scene, including the tail after the last beat. */
  duration: number;
  playing: boolean;
  /** Change it to start the scene over — the active tab, typically. */
  resetKey?: unknown;
  /** Fired once, when the scene has run its full length. */
  onEnd?: () => void;
  /** `prefers-reduced-motion`: hold one frame, drive nothing. */
  still?: boolean;
  /** Which frame to hold when `still`. Defaults to the last step. */
  stillStep?: number;
}

export function useTimeline({
  beats,
  duration,
  playing,
  resetKey,
  onEnd,
  still = false,
  stillStep,
}: TimelineArgs): number {
  const held = Math.min(stillStep ?? beats.length - 1, beats.length - 1);
  const [step, setStep] = useState(() => (still ? held : 0));

  // Kept in refs and refreshed after commit, never during render: the timer
  // reads them when it fires, and a parent that re-renders with a fresh `onEnd`
  // closure must not be able to restart the scene.
  const onEndRef = useRef(onEnd);
  const beatsRef = useRef(beats);
  useEffect(() => {
    onEndRef.current = onEnd;
    beatsRef.current = beats;
  });

  /** Clock reading banked at the last pause, so resuming owes only the rest. */
  const elapsedRef = useRef(0);
  const stepRef = useRef(still ? held : 0);
  const endedRef = useRef(false);

  useEffect(() => {
    elapsedRef.current = 0;
    endedRef.current = false;
    stepRef.current = still ? held : 0;
    setStep(stepRef.current);
  }, [resetKey, still, held]);

  useEffect(() => {
    if (still || !playing || endedRef.current) return;

    let timer: ReturnType<typeof setTimeout>;
    let startedAt = Date.now();

    const schedule = () => {
      const table = beatsRef.current;
      const current = stepRef.current;
      const nextAt = current < table.length - 1 ? (table[current + 1] ?? duration) : duration;
      const wait = Math.max(0, nextAt - elapsedRef.current);

      startedAt = Date.now();
      timer = setTimeout(() => {
        elapsedRef.current = nextAt;
        if (current < table.length - 1) {
          stepRef.current = current + 1;
          setStep(current + 1);
          schedule();
        } else {
          endedRef.current = true;
          onEndRef.current?.();
        }
      }, wait);
    };

    schedule();

    return () => {
      clearTimeout(timer);
      // Bank what this beat already served. Without it, a pointer resting on
      // the frame would rewind the viewer to the start of the beat every time
      // it moved.
      elapsedRef.current += Date.now() - startedAt;
    };
  }, [playing, still, duration, resetKey]);

  return step;
}

/**
 * Whether the viewer has asked their system for less movement.
 *
 * Answered on the very first render, not after an effect. Read late, it returns
 * false once and true immediately after, and anything that branches on it has
 * already committed to the wrong shape: an entrance that starts at opacity zero
 * and a `initial` prop that changes after mount, which motion does not act on.
 * That combination left the whole section invisible for exactly the people who
 * asked for less movement, and nothing on screen said so.
 */
export function usePrefersReducedMotion(): boolean {
  const [still, setStill] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setStill(query.matches);
    const onChange = (e: MediaQueryListEvent) => setStill(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return still;
}
