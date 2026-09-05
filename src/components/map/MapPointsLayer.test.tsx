import { describe, it, expect, vi } from "vitest";
import { render, act, screen } from "@testing-library/react";
import MapPointsLayer from "./MapPointsLayer";

const sourceProps = vi.fn();
const layerProps = vi.fn();

/**
 * A fake MapLibre map that captures both registration shapes `MapPointsLayer`
 * uses, and stores them separately: `map.on(type, layerId, handler)` (a
 * *delegated* listener) and `map.on(type, handler)` (unfiltered).
 *
 * Real MapLibre's delegated `on` (`Map.prototype._createDelegatedListener` in
 * `maplibre-gl/src/ui/map.ts`) runs `queryRenderedFeatures` itself and only
 * invokes the handler `if (features.length)` — a click that hits nothing
 * never reaches a layer-scoped handler at all. A fake that stored every
 * registration in one bucket regardless of arity could not tell the two
 * apart, and would happily invoke the layer-scoped handler on a miss —
 * something that cannot happen in the real map, and exactly the shape of bug
 * this file's tests are meant to catch.
 */
function makeFakeMap(hit: { properties: { id: unknown } } | undefined) {
  const layerHandlers: Record<string, (e: unknown) => void> = {};
  const mapHandlers: Record<string, (e: unknown) => void> = {};

  const fake = {
    on: vi.fn((type: string, layerIdOrHandler: unknown, handler?: (e: unknown) => void) => {
      if (typeof layerIdOrHandler === "function") {
        mapHandlers[type] = layerIdOrHandler as (e: unknown) => void;
      } else {
        layerHandlers[type] = handler!;
      }
    }),
    off: vi.fn(),
    queryRenderedFeatures: vi.fn(() => (hit ? [hit] : [])),
    getCanvas: vi.fn(() => ({ style: {} })),
    layerHandlers,
    mapHandlers,
    /**
     * Dispatches a click the way MapLibre really does: the layer-scoped
     * handler fires only when the layer query itself finds something; the
     * unfiltered handler always fires, both in registration order.
     */
    click(point: { x: number; y: number }) {
      const e = { point };
      if (fake.queryRenderedFeatures().length) {
        layerHandlers.click?.(e);
      }
      mapHandlers.click?.(e);
    },
  };
  return fake;
}

let fakeMap: ReturnType<typeof makeFakeMap> | null = null;

vi.mock("@vis.gl/react-maplibre", () => ({
  Source: (props: Record<string, unknown>) => {
    sourceProps(props);
    return <div>{props.children as React.ReactNode}</div>;
  },
  Layer: (props: Record<string, unknown>) => { layerProps(props); return null; },
  Popup: (props: Record<string, unknown>) => <div data-testid="popup">{props.children as React.ReactNode}</div>,
  useMap: () => ({ current: fakeMap }),
}));

const points = [
  { id: 1, lat: -19, lng: -65, color: "#DD0031", item: { name: "uno" } },
  { id: 2, lat: -17, lng: -63, color: "#249243", item: { name: "dos" } },
];

describe("MapPointsLayer", () => {
  it("sends every point to one source, flipped to [lng, lat]", () => {
    fakeMap = null;
    sourceProps.mockClear();
    render(<MapPointsLayer id="ops" points={points} renderPopup={() => null} />);

    const fc = sourceProps.mock.calls[0][0].data;
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].geometry.coordinates).toEqual([-65, -19]);
  });

  it("colours each dot from its own property instead of one colour for all", () => {
    fakeMap = null;
    layerProps.mockClear();
    render(<MapPointsLayer id="ops" points={points} renderPopup={() => null} />);

    expect(layerProps.mock.calls[0][0].paint["circle-color"]).toEqual(["get", "color"]);
  });

  it("draws a single layer whose one source still carries every point", () => {
    fakeMap = null;
    sourceProps.mockClear();
    layerProps.mockClear();
    const many = Array.from({ length: 500 }, (_, i) => ({
      id: i, lat: -19 + i / 1000, lng: -65, color: "#000", item: { name: `p${i}` },
    }));
    render(<MapPointsLayer id="ops" points={many} renderPopup={() => null} />);

    expect(layerProps).toHaveBeenCalledTimes(1);
    const fc = sourceProps.mock.calls[0][0].data;
    expect(fc.features).toHaveLength(500);
  });

  it("opens the card for the point that was clicked, found by its feature id", () => {
    // The circle MapLibre reports back carries the feature id of the second
    // point, not the first — this is exactly where a bug would open the
    // wrong marker's card.
    fakeMap = makeFakeMap({ properties: { id: 2 } });
    const renderPopup = vi.fn(() => null);
    render(<MapPointsLayer id="ops" points={points} renderPopup={renderPopup} />);

    act(() => {
      fakeMap!.click({ x: 0, y: 0 });
    });

    expect(renderPopup).toHaveBeenCalledWith(points[1].item);
  });

  it("does nothing when the click misses every circle", () => {
    fakeMap = makeFakeMap(undefined);
    const renderPopup = vi.fn(() => null);
    render(<MapPointsLayer id="ops" points={points} renderPopup={renderPopup} />);

    act(() => {
      fakeMap!.click({ x: 0, y: 0 });
    });

    expect(renderPopup).not.toHaveBeenCalled();
  });

  it("clears the open card when a later click on the map hits nothing", () => {
    // closeOnClick is off on this layer's Popup (the map click that opens a
    // card must not also close it), so the empty-map case has to close it by
    // hand — otherwise cards pile up with only the × left to dismiss them.
    // The layer-scoped listener can never see this click (MapLibre never
    // calls it on a miss), so this only works if a second, unfiltered
    // listener does the closing — which is exactly what's under test here.
    fakeMap = makeFakeMap({ properties: { id: 2 } });
    const renderPopup = (item: { name: string }) => <span>{item.name}</span>;
    render(<MapPointsLayer id="ops" points={points} renderPopup={renderPopup} />);

    act(() => {
      fakeMap!.click({ x: 0, y: 0 });
    });
    expect(screen.getByTestId("popup")).toHaveTextContent("dos");

    fakeMap!.queryRenderedFeatures = vi.fn(() => []);
    act(() => {
      fakeMap!.click({ x: 999, y: 999 });
    });

    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });

  it("closes the card instead of swapping it when a rerender's id space belongs to a different entity", () => {
    // Poles and events are two independent auto-increment sequences that both
    // start at 1: "evento-3" is unrelated to "poste-3", but as plain numbers
    // both are just 3. Namespacing per entity (what OperationsMap.tsx does)
    // is what keeps the reconciliation from confusing the two on a tab
    // switch. Proved against plain ids first: with `id: 3` on both sides this
    // assertion fails, because the reconciliation finds "some point with id
    // 3" and swaps the open card for the pole's instead of closing it.
    const eventoPoint = { id: "evento-3", lat: -19, lng: -65, color: "#DD0031", item: { name: "evento tres" } };
    const postePoint = { id: "poste-3", lat: -17, lng: -63, color: "#596BAB", item: { name: "poste tres" } };

    fakeMap = makeFakeMap({ properties: { id: "evento-3" } });
    const renderPopup = (item: { name: string }) => <span>{item.name}</span>;
    const { rerender } = render(
      <MapPointsLayer id="ops" points={[eventoPoint]} renderPopup={renderPopup} />,
    );

    act(() => {
      fakeMap!.click({ x: 0, y: 0 });
    });
    expect(screen.getByTestId("popup")).toHaveTextContent("evento tres");

    // Simulate a tab switch: the points array now comes from a wholly
    // different entity, which happens to reuse "3" as its own numeric id.
    rerender(<MapPointsLayer id="ops" points={[postePoint]} renderPopup={renderPopup} />);

    // The card must be gone — its point is gone — never showing the pole's
    // card in its place.
    expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
  });
});
