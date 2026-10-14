import type { ReactNode } from "react";

interface SonarRippleProps {
  /**
   * The diameter, in px, the rings start from, and the ripple's area is this plus 80. It is
   * whatever the caller measures its dot by, and the callers differ: `SonarMarker` passes
   * the fill's diameter (its border is drawn outside it), the network map passes the full
   * on-screen diameter, border included (`dotDiameter`). The rings start from the fill in
   * the first case and from the outer edge in the second.
   */
  dotPx: number;
  /** RGB values as "r, g, b" for the ripple color */
  rgb: string;
  /** The dot itself, centred in the ripple. It takes its own pointer events. */
  children: ReactNode;
}

/**
 * The ripple of a highlighted map dot, around whatever dot it is given. The
 * rings and their animation live in index.css (`.sonar-*`); this is the markup
 * they expect. `SonarMarker` puts a plain dot in it, and the network map puts
 * its city buttons in it, so both pulse the same way.
 *
 * The wrapper is the size of the ripple and lets every pointer event through:
 * the dot inside has to turn them back on, or a raised ripple would swallow
 * the clicks of every dot around it.
 */
export function SonarRipple({ dotPx, rgb, children }: SonarRippleProps) {
  const areaPx = dotPx + 80;
  return (
    <div
      className="sonar-root"
      style={{
        width: areaPx,
        height: areaPx,
        ["--dot" as string]: `${dotPx}px`,
        ["--rgb" as string]: rgb,
        pointerEvents: "none",
      }}
    >
      <span className="sonar-ring sonar-ring-1" />
      <span className="sonar-ring sonar-ring-2" />
      <span className="sonar-ring sonar-ring-1 sonar-b" />
      <span className="sonar-ring sonar-ring-2 sonar-b" />
      {children}
    </div>
  );
}
