import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import BaseMap from "./BaseMap";
import { MAP_STYLE_DARK, MAP_STYLE_LIGHT } from "./mapStyle";

const mapProps = vi.fn();
const navigationControlCalls = vi.fn();

vi.mock("@vis.gl/react-maplibre", () => ({
  Map: (props: Record<string, unknown>) => {
    mapProps(props);
    return <div data-testid="gl-map">{props.children as React.ReactNode}</div>;
  },
  NavigationControl: (props: Record<string, unknown>) => {
    navigationControlCalls(props);
    return null;
  },
}));

const theme = { resolvedTheme: "light" };
vi.mock("../theme-provider", () => ({ useTheme: () => theme }));

describe("BaseMap", () => {
  it("hands MapLibre the centre as longitude and latitude, not the other way round", () => {
    mapProps.mockClear();
    render(<BaseMap center={{ lat: -19.03, lng: -65.26 }} zoom={5} />);

    const props = mapProps.mock.calls[0][0];
    expect(props.initialViewState).toMatchObject({
      longitude: -65.26,
      latitude: -19.03,
      zoom: 5,
    });
  });

  it("follows the theme", () => {
    mapProps.mockClear();
    theme.resolvedTheme = "light";
    render(<BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5} />);
    expect(mapProps.mock.calls[0][0].mapStyle).toBe(MAP_STYLE_LIGHT);

    mapProps.mockClear();
    theme.resolvedTheme = "dark";
    render(<BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5} />);
    expect(mapProps.mock.calls[0][0].mapStyle).toBe(MAP_STYLE_DARK);
  });

  it("reports clicks as a named lat/lng pair", () => {
    mapProps.mockClear();
    const onMapClick = vi.fn();
    render(<BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5} onMapClick={onMapClick} />);

    const props = mapProps.mock.calls[0][0] as { onClick: (e: unknown) => void };
    props.onClick({ lngLat: { lng: -65.26, lat: -19.03 } });

    expect(onMapClick).toHaveBeenCalledWith({ lat: -19.03, lng: -65.26 });
  });

  it("renders what it is given inside the map", () => {
    const { getByText } = render(
      <BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5}><span>hijo</span></BaseMap>,
    );
    expect(getByText("hijo")).toBeTruthy();
  });

  it("puts className on the wrapper, not on the map, which silently ignores it", () => {
    mapProps.mockClear();
    const { container } = render(
      <BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5} className="h-full" />,
    );

    expect((container.firstChild as HTMLElement).className).toBe("h-full");
    expect(mapProps.mock.calls[0][0].className).toBeUndefined();
  });

  it("adds no zoom control, because every screen it replaces switched that off", () => {
    navigationControlCalls.mockClear();
    render(<BaseMap center={{ lat: 0.1, lng: 0.2 }} zoom={5} />);
    expect(navigationControlCalls).not.toHaveBeenCalled();
  });
});
