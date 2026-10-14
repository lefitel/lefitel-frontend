import { useEffect } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLatest } from "./useLatest";

describe("useLatest", () => {
  it("holds the value from the very first render", () => {
    let seen: number | undefined;
    function Probe() {
      const ref = useLatest(1);
      seen = ref.current;
      return null;
    }
    render(<Probe />);
    expect(seen).toBe(1);
  });

  it("is already updated when the effects of the same commit run", () => {
    const inEffect: number[] = [];
    const duringRender: number[] = [];
    function Probe({ value }: { value: number }) {
      const ref = useLatest(value);
      duringRender.push(ref.current);
      useEffect(() => {
        inEffect.push(ref.current);
      });
      return null;
    }
    const { rerender } = render(<Probe value={1} />);
    rerender(<Probe value={2} />);
    rerender(<Probe value={3} />);
    expect(inEffect).toEqual([1, 2, 3]);
    // Render itself still sees the previous commit: that is why callers must
    // read the value, not the ref, while rendering.
    expect(duringRender).toEqual([1, 1, 2]);
  });

  it("keeps the same ref object across renders", () => {
    const refs: unknown[] = [];
    function Probe({ value }: { value: number }) {
      refs.push(useLatest(value));
      return null;
    }
    const { rerender } = render(<Probe value={1} />);
    rerender(<Probe value={2} />);
    expect(refs[0]).toBe(refs[1]);
  });
});
