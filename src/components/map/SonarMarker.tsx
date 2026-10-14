import { useState } from "react";
import { Marker, Popup } from "@vis.gl/react-maplibre";
import { MAP_RADIUS, MAP_WEIGHT } from "./mapConstants";
import { SonarRipple } from "./SonarRipple";

interface SonarMarkerProps {
  /** Latitude first, the way the screens already write it. */
  center: [number, number];
  fillColor: string;
  strokeColor: string;
  /** RGB values as "r, g, b" for the ripple color */
  rgb: string;
  dotRadius?: number;
  weight?: number;
  popupMinWidth?: number;
  children?: React.ReactNode;
}

/**
 * The highlighted subject of a map: the pole, the city or the event the screen
 * is about. One per map, so it stays a DOM marker — the CSS ripple in
 * index.css is what makes it read as "this is the one you came to see", and
 * CSS cannot reach a shape painted into the WebGL canvas.
 */
export function SonarMarker({
  center,
  fillColor,
  strokeColor,
  rgb,
  dotRadius = MAP_RADIUS.main,
  weight = MAP_WEIGHT.main,
  popupMinWidth = 240,
  children,
}: SonarMarkerProps) {
  const [open, setOpen] = useState(false);
  const dotPx = dotRadius * 2;

  return (
    <>
      <Marker
        longitude={center[1]}
        latitude={center[0]}
        anchor="center"
        // Above every other dot, always. Markers carry no order of their own and
        // stack as they are inserted, so the neighbours of a stretch — which load
        // after the subject — were landing on top of it. And no pointer events
        // on the wrapper: it is the size of the ripple, and raised like this it
        // would swallow the clicks of every dot within 48 px. Only the dot
        // itself takes them.
        style={{ zIndex: 1, pointerEvents: "none" }}
        onClick={(e) => {
          e.originalEvent?.stopPropagation();
          if (children) setOpen(true);
        }}
      >
        <SonarRipple dotPx={dotPx} rgb={rgb}>
          <span
            className="sonar-dot"
            style={{
              width: dotPx,
              height: dotPx,
              background: fillColor,
              border: `${weight}px solid ${strokeColor}`,
              // The border outside the radius, as `MapPoint` draws it. Under
              // the page's `border-box` it went inside, so the same radius gave
              // a smaller dot here than there — and this is the one that has
              // to be the largest on the map.
              boxSizing: "content-box",
              pointerEvents: "auto",
              cursor: children ? "pointer" : "default",
            }}
          />
        </SonarRipple>
      </Marker>

      {open && children && (
        <Popup
          longitude={center[1]}
          latitude={center[0]}
          offset={dotPx}
          onClose={() => setOpen(false)}
          maxWidth="280px"
        >
          <div style={{ minWidth: popupMinWidth }}>{children}</div>
        </Popup>
      )}
    </>
  );
}
