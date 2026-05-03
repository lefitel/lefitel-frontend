import { CircleMarker, CircleMarkerProps } from "react-leaflet";

interface PulsingCircleMarkerProps extends CircleMarkerProps {
  baseRadius?: number;
  /** Unused — kept for API compatibility. Scale is handled by CSS. */
  peakRadius?: number;
  /** Unused — kept for API compatibility. */
  duration?: number;
  /** When false, the marker stays static. Default true. */
  pulse?: boolean;
}

export function PulsingCircleMarker({
  baseRadius,
  peakRadius: _peakRadius,
  duration: _duration,
  pulse = true,
  radius,
  pathOptions,
  ...rest
}: PulsingCircleMarkerProps) {
  const base = baseRadius ?? (typeof radius === "number" ? radius : 8);

  return (
    <CircleMarker
      radius={base}
      pathOptions={{
        ...pathOptions,
        className: [pathOptions?.className, pulse ? "circle-pulse-marker" : ""]
          .filter(Boolean)
          .join(" "),
      }}
      {...rest}
    />
  );
}
