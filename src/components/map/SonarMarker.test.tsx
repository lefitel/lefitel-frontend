import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SonarMarker } from "./SonarMarker";

const markerProps = vi.fn();
const stopPropagation = vi.fn();

vi.mock("@vis.gl/react-maplibre", () => ({
  Marker: (props: Record<string, unknown>) => {
    markerProps(props);
    return (
      <div
        data-testid="marker"
        onClick={() => (props.onClick as (e: unknown) => void)?.({ originalEvent: { stopPropagation } })}
      >
        {props.children as React.ReactNode}
      </div>
    );
  },
  Popup: (props: Record<string, unknown>) => <div data-testid="popup">{props.children as React.ReactNode}</div>,
}));

describe("SonarMarker", () => {
  it("takes the Leaflet-shaped [lat, lng] tuple and hands MapLibre the flipped pair", () => {
    markerProps.mockClear();
    render(<SonarMarker center={[-19.03, -65.26]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0" />);
    expect(markerProps.mock.calls[0][0]).toMatchObject({ longitude: -65.26, latitude: -19.03 });
  });

  it("keeps the ripple markup the stylesheet expects", () => {
    const { container } = render(
      <SonarMarker center={[1, 2]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0" />,
    );
    expect(container.querySelector(".sonar-root")).not.toBeNull();
    expect(container.querySelectorAll(".sonar-ring")).toHaveLength(4);
    expect(container.querySelector(".sonar-dot")).not.toBeNull();
  });

  it("opens its card on click, like the old popup did", () => {
    const { getByTestId, queryByTestId } = render(
      <SonarMarker center={[1, 2]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0">
        <span>ficha</span>
      </SonarMarker>,
    );
    expect(queryByTestId("popup")).toBeNull();
    fireEvent.click(getByTestId("marker"));
    expect(queryByTestId("popup")).not.toBeNull();
  });

  it("sits above the other dots, and lets clicks through everything but the dot", () => {
    // The neighbours of a stretch load after the subject and were drawn over it.
    // Raising a 96 px wrapper without this would trade that for a worse one: a
    // square around the subject where no other dot can be clicked.
    markerProps.mockClear();
    const { container } = render(
      <SonarMarker center={[1, 2]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0" />,
    );
    const style = markerProps.mock.calls[0][0].style as React.CSSProperties;
    expect(style.zIndex).toBe(1);
    expect(style.pointerEvents).toBe("none");
    expect((container.querySelector(".sonar-root") as HTMLElement).style.pointerEvents).toBe("none");
    expect((container.querySelector(".sonar-dot") as HTMLElement).style.pointerEvents).toBe("auto");
  });

  it("keeps its click from reaching the map, which would move the pin underneath", () => {
    stopPropagation.mockClear();
    const { getByTestId } = render(
      <SonarMarker center={[1, 2]} fillColor="#000" strokeColor="#fff" rgb="0, 0, 0" />,
    );
    fireEvent.click(getByTestId("marker"));
    expect(stopPropagation).toHaveBeenCalled();
  });
});
