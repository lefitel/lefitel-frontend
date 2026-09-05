import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useFitCoords } from "./useFitCoords";
import { FitView } from "./useFitCoords";

const fitBounds = vi.fn();
const flyTo = vi.fn();
// Hoisted so `current` resolves to the same reference on every render, the
// way the real map instance does. Rebuilding this object per call (as an
// inline literal in the factory below would) makes `map` itself a changed
// dependency on every rerender, which masks the very bug the "refits" test
// below exists to catch: the effect would then always refire regardless of
// coords, whether the dependency list is right or wrong.
const mapInstance = { fitBounds, flyTo };

vi.mock("@vis.gl/react-maplibre", () => ({
  useMap: () => ({ current: mapInstance }),
}));

function Probe(props: Parameters<typeof useFitCoords>[0]) {
  useFitCoords(props);
  return null;
}

describe("useFitCoords", () => {
  beforeEach(() => { fitBounds.mockClear(); flyTo.mockClear(); });

  it("fits the box when asked and there are at least two points", () => {
    render(<Probe
      coords={[{ lat: -19, lng: -65 }, { lat: -17, lng: -63 }]}
      fit
      center={{ lat: -18, lng: -64 }}
      zoom={13}
    />);

    expect(fitBounds).toHaveBeenCalledWith([[-65, -19], [-63, -17]], { padding: 40, duration: 0 });
    expect(flyTo).not.toHaveBeenCalled();
  });

  it("centres instead of fitting when fit is off", () => {
    render(<Probe
      coords={[{ lat: -19, lng: -65 }, { lat: -17, lng: -63 }]}
      fit={false}
      center={{ lat: -18, lng: -64 }}
      zoom={13}
    />);

    expect(flyTo).toHaveBeenCalledWith({ center: [-64, -18], zoom: 13, duration: 0 });
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("does nothing at all when the centre has no coordinates and there is no box", () => {
    render(<Probe coords={[]} fit={false} center={{ lat: 0, lng: 0 }} zoom={13} />);
    expect(flyTo).not.toHaveBeenCalled();
    expect(fitBounds).not.toHaveBeenCalled();
  });

  it("FitView renders nothing and just runs the hook", () => {
    const { container } = render(
      <FitView coords={[{ lat: -19, lng: -65 }, { lat: -17, lng: -63 }]} fit center={{ lat: -18, lng: -64 }} zoom={13} />,
    );
    expect(container.firstChild).toBeNull();
    expect(fitBounds).toHaveBeenCalled();
  });

  it("refits when the points change but their count does not", () => {
    const first = [{ lat: -19, lng: -65 }, { lat: -17, lng: -63 }];
    const second = [{ lat: -12, lng: -77 }, { lat: -10, lng: -75 }];

    const { rerender } = render(
      <Probe coords={first} fit center={{ lat: -18, lng: -64 }} zoom={13} />,
    );
    expect(fitBounds).toHaveBeenCalledTimes(1);

    rerender(<Probe coords={second} fit center={{ lat: -18, lng: -64 }} zoom={13} />);

    expect(fitBounds).toHaveBeenCalledTimes(2);
    expect(fitBounds).toHaveBeenLastCalledWith([[-77, -12], [-75, -10]], { padding: 40, duration: 0 });
  });

  it("does not refly when fit is off and the box changes underneath it", () => {
    // fit={false} never reads `bounds`, so a box change must not retrigger
    // the effect. This is what makes the map jump while a pin is being
    // placed in PosteSheet: `coords` changes on every click, widening or
    // moving the box, even though this branch only cares about `center`.
    const first = [{ lat: -19, lng: -65 }, { lat: -17, lng: -63 }];
    const second = [{ lat: -12, lng: -77 }, { lat: -10, lng: -75 }];

    const { rerender } = render(
      <Probe coords={first} fit={false} center={{ lat: -18, lng: -64 }} zoom={13} />,
    );
    expect(flyTo).toHaveBeenCalledTimes(1);

    rerender(<Probe coords={second} fit={false} center={{ lat: -18, lng: -64 }} zoom={13} />);

    expect(flyTo).toHaveBeenCalledTimes(1);
  });
});
