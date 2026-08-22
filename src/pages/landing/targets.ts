import { useLayoutEffect, useState } from "react";

/**
 * Where a thing is, asked of the layout rather than of a table of numbers.
 *
 * A piece names what the pointer is going for — `data-target="ev-save"` — and
 * this measures it. Hard-coded coordinates were the obvious alternative and the
 * wrong one: nudge one padding value, or let a column reflow at some width
 * nobody tested, and the arrow starts clicking three pixels beside the button
 * it is meant to be pressing, silently, in the one part of the page whose whole
 * job is to look deliberate.
 *
 * Readings are divided by any transform scale on the piece, so a measurement
 * means the same thing whether or not the piece has been scaled.
 */
export interface TargetBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useTargetBox(
  root: React.RefObject<HTMLElement | null>,
  target: string | null | undefined,
  step: number,
): TargetBox {
  const [box, setBox] = useState<TargetBox>({ x: -60, y: -60, w: 0, h: 0 });

  useLayoutEffect(() => {
    const node = root.current;
    if (!node || !target) return;
    const el = node.querySelector<HTMLElement>(`[data-target="${target}"]`);
    if (!el) return;

    const frame = node.getBoundingClientRect();
    const scale = node.offsetWidth > 0 ? frame.width / node.offsetWidth : 1;
    if (!scale) return;

    const hit = el.getBoundingClientRect();
    setBox({
      x: (hit.left - frame.left + hit.width / 2) / scale,
      y: (hit.top - frame.top + hit.height / 2) / scale,
      w: hit.width / scale,
      h: hit.height / scale,
    });
  }, [root, target, step]);

  return box;
}
