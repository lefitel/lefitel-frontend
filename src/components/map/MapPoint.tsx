import { useState } from "react";
import { Marker, Popup } from "@vis.gl/react-maplibre";
import type { LatLng } from "./mapGeo";

interface MapPointProps {
  center: LatLng;
  /** Radius in pixels, as Leaflet's CircleMarker took it. */
  radius?: number;
  fillColor: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  popupMinWidth?: number;
  children?: React.ReactNode;
}

/**
 * A single dot with an optional card. Screens that draw a handful of points
 * use this; the operations map, whose count has no ceiling, uses
 * MapPointsLayer instead, which draws them all in one WebGL layer.
 *
 * In vis.gl a Popup is a sibling of its Marker, not a child, so the open
 * state lives here and screens keep writing the nested JSX they wrote with
 * react-leaflet.
 */
export default function MapPoint({
  center,
  radius = 7,
  fillColor,
  strokeColor = "#fff",
  strokeWidth = 1.5,
  fillOpacity = 0.95,
  popupMinWidth = 200,
  children,
}: MapPointProps) {
  const [open, setOpen] = useState(false);
  const size = radius * 2;

  return (
    <>
      <Marker
        longitude={center.lng}
        latitude={center.lat}
        anchor="center"
        onClick={(e) => {
          // Without this the click also reaches the map underneath, which on
          // the two upsert sheets would move the pin the user just clicked.
          e.originalEvent?.stopPropagation();
          if (children) setOpen(true);
        }}
      >
        <span
          style={{
            display: "block",
            width: size,
            height: size,
            borderRadius: "50%",
            // Only the fill fades with fillOpacity — the border carries no
            // opacity of its own, the way Leaflet's fillOpacity worked.
            background: `color-mix(in srgb, ${fillColor} ${fillOpacity * 100}%, transparent)`,
            border: `${strokeWidth}px solid ${strokeColor}`,
            boxSizing: "content-box",
            cursor: children ? "pointer" : "default",
          }}
        />
      </Marker>

      {open && children && (
        <Popup
          longitude={center.lng}
          latitude={center.lat}
          offset={size}
          onClose={() => setOpen(false)}
          maxWidth={`${Math.max(popupMinWidth, 260)}px`}
        >
          <div style={{ minWidth: popupMinWidth }}>{children}</div>
        </Popup>
      )}
    </>
  );
}
