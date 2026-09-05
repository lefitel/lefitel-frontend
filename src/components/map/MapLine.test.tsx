import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import MapLine from "./MapLine";

const sourceProps = vi.fn();
const layerProps = vi.fn();

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
});
