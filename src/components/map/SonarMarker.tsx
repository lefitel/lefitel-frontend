import { useState } from "react";
import { Marker, Popup } from "@vis.gl/react-maplibre";

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
  dotRadius = 8,
  weight = 1.5,
  popupMinWidth = 240,
  children,
}: SonarMarkerProps) {
  const [open, setOpen] = useState(false);
  const dotPx = dotRadius * 2;
  const areaPx = dotPx + 80;

  return (
    <>
      <Marker
        longitude={center[1]}
        latitude={center[0]}
        anchor="center"
        onClick={(e) => {
          e.originalEvent?.stopPropagation();
          if (children) setOpen(true);
        }}
      >
        <div
          className="sonar-root"
          style={{
            width: areaPx,
            height: areaPx,
            ["--dot" as string]: `${dotPx}px`,
            ["--rgb" as string]: rgb,
            cursor: children ? "pointer" : "default",
          }}
        >
          <span className="sonar-ring sonar-ring-1" />
          <span className="sonar-ring sonar-ring-2" />
          <span className="sonar-ring sonar-ring-1 sonar-b" />
          <span className="sonar-ring sonar-ring-2 sonar-b" />
          <span
            className="sonar-dot"
            style={{
              width: dotPx,
              height: dotPx,
              background: fillColor,
              border: `${weight}px solid ${strokeColor}`,
            }}
          />
        </div>
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
