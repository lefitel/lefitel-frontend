import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScrollFade } from "./useScrollFade";

const FADE_HEIGHT = 48;

/**
 * jsdom lays nothing out, so every measurement the hook reads is 0 and the
 * fade would look permanently spent. These stand in for a real scroller.
 */
function measure(node: HTMLElement, sizes: { scrollHeight: number; clientHeight: number }) {
  Object.defineProperty(node, "scrollHeight", { value: sizes.scrollHeight, configurable: true });
  Object.defineProperty(node, "clientHeight", { value: sizes.clientHeight, configurable: true });
  Object.defineProperty(node, "scrollTop", { value: 0, writable: true, configurable: true });
}

/**
 * Mirrors the shell: the fade is a SIBLING of the scroller, never a child, or
 * it would scroll away with the content it covers.
 */
function mount(sizes: { scrollHeight: number; clientHeight: number }) {
  const Probe = () => {
    const { scroller, fade } = useScrollFade<HTMLDivElement, HTMLDivElement>("/app/postes");
    return (
      <div>
        <div data-testid="scroller" ref={scroller}>
          <div data-testid="content" />
        </div>
        <div data-testid="fade" ref={fade} style={{ opacity: 0 }} />
      </div>
    );
  };

  // The ref must carry the fake metrics before the hook's effect first reads
  // them, so they are installed from the ref callback, not afterwards.
  const view = render(<Probe />);
  const box = view.getByTestId("scroller");
  const veil = view.getByTestId("fade");
  Object.defineProperty(veil, "offsetHeight", { value: FADE_HEIGHT, configurable: true });
  measure(box, sizes);

  const scrollTo = (top: number) => {
    act(() => {
      (box as HTMLElement & { scrollTop: number }).scrollTop = top;
      box.dispatchEvent(new Event("scroll"));
    });
  };

  return { box, veil, scrollTo, opacity: () => veil.style.opacity };
}

describe("useScrollFade", () => {
  it("shows the fade at full strength while content remains below the fold", () => {
    const { scrollTo, opacity } = mount({ scrollHeight: 2000, clientHeight: 600 });
    scrollTo(0);
    expect(opacity()).toBe("1");
  });

  it("clears the fade completely at the bottom, so nothing veils the pagination", () => {
    const { scrollTo, opacity } = mount({ scrollHeight: 2000, clientHeight: 600 });
    scrollTo(1400); // 2000 - 600: the last pixel
    expect(opacity()).toBe("0");
  });

  it("winds the fade down in step with the scroll over its own height", () => {
    const { scrollTo, opacity } = mount({ scrollHeight: 2000, clientHeight: 600 });
    scrollTo(1400 - FADE_HEIGHT / 2); // half a fade-height still to go
    expect(Number(opacity())).toBeCloseTo(0.5, 2);
  });

  it("stays invisible when the content never overflows", () => {
    const { scrollTo, opacity } = mount({ scrollHeight: 400, clientHeight: 600 });
    scrollTo(0);
    expect(opacity()).toBe("0");
  });

  it("re-measures when content arrives without anyone scrolling", async () => {
    const { box, veil, opacity } = mount({ scrollHeight: 400, clientHeight: 600 });
    expect(opacity()).toBe("0");

    // A table lands from the API: the page grows, but no scroll event fires.
    // MutationObserver hands over its records on a microtask, so the awaited
    // act() is what lets the hook see the swap.
    await act(async () => {
      Object.defineProperty(box, "scrollHeight", { value: 2000, configurable: true });
      box.replaceChildren(document.createElement("table"));
    });

    expect(veil.style.opacity).toBe("1");
  });
});
