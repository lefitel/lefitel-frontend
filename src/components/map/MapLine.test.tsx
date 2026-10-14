import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import MapLine from "./MapLine";
import { ROUTE_PAINT } from "./mapConstants";

const sourceProps = vi.fn();
const layerProps = vi.fn();

const theme = { resolvedTheme: "light" };
vi.mock("../theme-provider", () => ({ useTheme: () => theme }));

vi.mock("@vis.gl/react-maplibre", () => ({
  Source: (props: Record<string, unknown>) => {
    sourceProps(props);
    return <div>{props.children as React.ReactNode}</div>;
  },
  Layer: (props: Record<string, unknown>) => {
    layerProps(props);
    return null;
  },
}));

describe("MapLine", () => {
  it("writes every vertex as [lng, lat]", () => {
    sourceProps.mockClear();
    render(<MapLine id="route" positions={[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]} />);

    const data = sourceProps.mock.calls[0][0].data;
    expect(data.geometry.coordinates).toEqual([[2, 1], [4, 3]]);
  });

  it("draws nothing when there are fewer than two vertices", () => {
    sourceProps.mockClear();
    const { container } = render(<MapLine id="route" positions={[{ lat: 1, lng: 2 }]} />);
    expect(sourceProps).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it("names its source and layer after the id it was given", () => {
    sourceProps.mockClear();
    layerProps.mockClear();
    render(<MapLine id="tramo" positions={[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]} />);

    expect(sourceProps.mock.calls[0][0].id).toBe("tramo");
    expect(layerProps.mock.calls[0][0].id).toBe("tramo-line");
    expect(layerProps.mock.calls[0][0].type).toBe("line");
  });

  it("hands the layer the one it must sit under, and leaves it unset by default", () => {
    layerProps.mockClear();
    render(<MapLine id="a" positions={[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]} beforeId="postes-circles" />);
    expect(layerProps.mock.calls[0][0].beforeId).toBe("postes-circles");

    layerProps.mockClear();
    render(<MapLine id="b" positions={[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]} />);
    expect(layerProps.mock.calls[0][0].beforeId).toBeUndefined();
  });

  describe("how the route is drawn on each base map", () => {
    const paintFor = (resolvedTheme: string, props: Record<string, unknown> = {}) => {
      theme.resolvedTheme = resolvedTheme;
      layerProps.mockClear();
      render(<MapLine id="r" positions={[{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }]} {...props} />);
      return layerProps.mock.calls[0][0].paint as Record<string, unknown>;
    };

    it("follows the theme when nobody says otherwise", () => {
      // One blue at 70% served both maps, and on the dark one the line was hard
      // to find. The four screens that draw a route pass no colour now, so this
      // is what all four show.
      expect(paintFor("light")).toMatchObject({
        "line-color": ROUTE_PAINT.light.color, "line-opacity": ROUTE_PAINT.light.opacity,
      });
      expect(paintFor("dark")).toMatchObject({
        "line-color": ROUTE_PAINT.dark.color, "line-opacity": ROUTE_PAINT.dark.opacity,
      });
      // And they are two different lines, which is the whole point.
      expect(ROUTE_PAINT.dark.color).not.toBe(ROUTE_PAINT.light.color);
    });

    it("still takes a colour from whoever has a reason to give one", () => {
      expect(paintFor("dark", { color: "#ff0000", opacity: 0.4 })).toMatchObject({
        "line-color": "#ff0000", "line-opacity": 0.4,
      });
    });
  });
});
