import { useMemo } from "react";
import L from "leaflet";
import { Marker } from "react-leaflet";

interface SonarMarkerProps {
  center: [number, number];
  fillColor: string;
  strokeColor: string;
  /** RGB values as "r, g, b" for the ripple color */
  rgb: string;
  dotRadius?: number;
  weight?: number;
  pane?: string;
  children?: React.ReactNode;
}

export function SonarMarker({
  center,
  fillColor,
  strokeColor,
  rgb,
  dotRadius = 8,
  weight = 1.5,
  pane,
  children,
}: SonarMarkerProps) {
  const dotPx = dotRadius * 2;
  const areaPx = dotPx + 80;

  const icon = useMemo(
    () =>
      L.divIcon({
        className: "sonar-marker",
        html: `<div class="sonar-root" style="width:${areaPx}px;height:${areaPx}px;--dot:${dotPx}px;--rgb:${rgb}">
  <span class="sonar-ring sonar-ring-1"></span>
  <span class="sonar-ring sonar-ring-2"></span>
  <span class="sonar-ring sonar-ring-1 sonar-b"></span>
  <span class="sonar-ring sonar-ring-2 sonar-b"></span>
  <span class="sonar-dot" style="width:${dotPx}px;height:${dotPx}px;background:${fillColor};border:${weight}px solid ${strokeColor}"></span>
</div>`,
        iconSize: [areaPx, areaPx],
        iconAnchor: [areaPx / 2, areaPx / 2],
      }),
    [fillColor, strokeColor, rgb, dotPx, areaPx, weight],
  );

  return (
    <Marker position={center} icon={icon} pane={pane ?? "markerPane"}>
      {children}
    </Marker>
  );
}
