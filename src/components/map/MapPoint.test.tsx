import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import MapPoint from "./MapPoint";

const markerProps = vi.fn();
const popupProps = vi.fn();

vi.mock("@vis.gl/react-maplibre", () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps(props);
    return (
      <div
        data-testid="marker"
        onClick={() => (props.onClick as (e: unknown) => void)?.({ originalEvent: { stopPropagation() {} } })}
      >
        {props.children as React.ReactNode}
      </div>
    );
  },
  Popup: (props: Record<string, unknown>) => {
    popupProps(props);
    return <div data-testid="popup">{props.children as React.ReactNode}</div>;
  },
}));

describe("MapPoint", () => {
  it("places the marker with longitude and latitude the right way round", () => {
    markerProps.mockClear();
    render(<MapPoint center={{ lat: -19.03, lng: -65.26 }} fillColor="#000" />);
    expect(markerProps.mock.calls[0][0]).toMatchObject({ longitude: -65.26, latitude: -19.03 });
  });

  it("keeps the popup closed until the point is clicked", () => {
    const { queryByTestId, getByTestId } = render(
      <MapPoint center={{ lat: 1, lng: 2 }} fillColor="#000"><span>ficha</span></MapPoint>,
    );
    expect(queryByTestId("popup")).toBeNull();

    fireEvent.click(getByTestId("marker"));
    expect(queryByTestId("popup")).not.toBeNull();
  });

  it("renders no popup at all when it was given no children", () => {
    const { getByTestId, queryByTestId, rerender } = render(
      <MapPoint center={{ lat: 1, lng: 2 }} fillColor="#000" />,
    );
    fireEvent.click(getByTestId("marker"));
    expect(queryByTestId("popup")).toBeNull();

    // The click must not have opened anything: if it had set the open state,
    // giving the point children afterwards would reveal a popup nobody asked for.
    rerender(<MapPoint center={{ lat: 1, lng: 2 }} fillColor="#000"><span>ficha</span></MapPoint>);
    expect(queryByTestId("popup")).toBeNull();
  });
});
