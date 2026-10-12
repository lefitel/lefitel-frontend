// Whether an element has room, as a yes or a no.
//
// The dashboard's chart doubles its points once it is wide enough. The width
// that matters is the chart's own — the sidebar opening takes 13rem from it
// without the window changing size — so it is observed on the element, and it
// is reported as a boolean so that a resize dragging through hundreds of
// widths re-renders the page once, when the answer changes, and not per pixel.
//
// jsdom lays nothing out, so the observer is a stand-in that hands the hook
// whatever width the test says.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useIsWiderThan } from "./useIsWiderThan";

let notify: (width: number) => void;
let disconnect: ReturnType<typeof vi.fn>;
let renders = 0;

beforeEach(() => {
  renders = 0;
  disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: ResizeObserverCallback) {
        notify = (width) =>
          cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver);
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect;
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

function Probe() {
  const [ref, wide] = useIsWiderThan<HTMLDivElement>(1000);
  renders++;
  return <div ref={ref}>{wide ? "wide" : "narrow"}</div>;
}

describe("useIsWiderThan", () => {
  it("says no until the element has been measured", () => {
    render(<Probe />);

    expect(screen.getByText("narrow")).toBeTruthy();
  });

  it("says yes from the threshold on, and no again below it", () => {
    render(<Probe />);

    act(() => notify(999));
    expect(screen.getByText("narrow")).toBeTruthy();
    act(() => notify(1000));
    expect(screen.getByText("wide")).toBeTruthy();
    act(() => notify(640));
    expect(screen.getByText("narrow")).toBeTruthy();
  });

  it("does not re-render once per width while the answer stays as it was", () => {
    render(<Probe />);
    act(() => notify(1200));
    const after = renders;

    // Ninety-nine widths, each in its own batch, the way a drag delivers them.
    for (let w = 1201; w < 1300; w++) act(() => notify(w));

    // One, not zero: React may spend a single render confirming that the first
    // identical value changes nothing before it starts discarding them outright.
    expect(renders - after).toBeLessThanOrEqual(1);
  });

  it("stops observing when the element goes away", () => {
    const { unmount } = render(<Probe />);

    unmount();

    expect(disconnect).toHaveBeenCalled();
  });
});
