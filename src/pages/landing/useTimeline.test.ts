import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { stepAt, usePrefersReducedMotion, useTimeline } from "./useTimeline";

describe("stepAt", () => {
  const beats = [0, 1000, 2500, 4000];

  it("sits on the first step before the second beat", () => {
    expect(stepAt(beats, 0)).toBe(0);
    expect(stepAt(beats, 999)).toBe(0);
  });

  it("moves on at each boundary", () => {
    expect(stepAt(beats, 1000)).toBe(1);
    expect(stepAt(beats, 2499)).toBe(1);
    expect(stepAt(beats, 2500)).toBe(2);
    expect(stepAt(beats, 4000)).toBe(3);
  });

  it("stays on the last step past the end", () => {
    expect(stepAt(beats, 99999)).toBe(3);
  });

  it("never returns a negative step for a nonsense clock", () => {
    expect(stepAt(beats, -50)).toBe(0);
  });
});

describe("useTimeline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const beats = [0, 1000, 2500];
  const duration = 4000;

  it("starts on the first step", () => {
    const { result } = renderHook(() => useTimeline({ beats, duration, playing: true }));
    expect(result.current).toBe(0);
  });

  it("advances one step per beat", () => {
    const { result } = renderHook(() => useTimeline({ beats, duration, playing: true }));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current).toBe(2);
  });

  it("reports the end exactly once", () => {
    const onEnd = vi.fn();
    renderHook(() => useTimeline({ beats, duration, playing: true, onEnd }));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  // A pointer resting on the frame must not cost the viewer the beat they were
  // half way through: pausing banks the time already served, and resuming asks
  // only for the remainder.
  it("resumes a paused beat from where it stopped", () => {
    const { result, rerender } = renderHook(
      ({ playing }) => useTimeline({ beats, duration, playing }),
      { initialProps: { playing: true } },
    );
    act(() => { vi.advanceTimersByTime(800); });
    rerender({ playing: false });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current).toBe(0);

    rerender({ playing: true });
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe(0);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(1);
  });

  it("starts over when the scene changes", () => {
    const { result, rerender } = renderHook(
      ({ resetKey }) => useTimeline({ beats, duration, playing: true, resetKey }),
      { initialProps: { resetKey: "map" } },
    );
    act(() => { vi.advanceTimersByTime(2600); });
    expect(result.current).toBe(2);

    rerender({ resetKey: "eventos" });
    expect(result.current).toBe(0);
  });

  // Someone who asked their system for less movement gets the finished screen,
  // not an empty one that never fills in, and the tabs stop driving themselves.
  it("shows the last step and never advances when motion is off", () => {
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useTimeline({ beats, duration, playing: true, onEnd, still: true }),
    );
    expect(result.current).toBe(2);
    act(() => { vi.advanceTimersByTime(10000); });
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe("usePrefersReducedMotion", () => {
  const setQuery = (matches: boolean) => {
    window.matchMedia = vi.fn().mockImplementation((media: string) => ({
      matches,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  };

  // Answered late, it says "no" for one render, and anything that branched on
  // that answer has already committed to the wrong shape. That is not a
  // theoretical worry: it left the whole showcase at opacity zero, invisible to
  // exactly the people who asked for less movement.
  it("answers on the first render, not after an effect", () => {
    setQuery(true);
    const seen: boolean[] = [];
    renderHook(() => {
      seen.push(usePrefersReducedMotion());
    });
    expect(seen[0]).toBe(true);
  });

  it("says no when the viewer has not asked for it", () => {
    setQuery(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });
});
