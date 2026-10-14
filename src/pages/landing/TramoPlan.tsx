import { motion } from "motion/react";
import { EXPO } from "./tokens";
import { usePrefersReducedMotion } from "./useTimeline";
import { useNarrow } from "./useNarrow";

/**
 * The hero drawing: five poles of a tramo in elevation, one of them flagged.
 *
 * It is the page's thesis in one picture. Osefi's work is knowing the state of
 * each pole, so the opener is a line plan of a span with the faulty pole called
 * out, the way a survey sheet would mark it. The pole is the P472 the showcase
 * follows further down, with the same defect, so the page opens and continues
 * on one thread.
 *
 * The drawing builds once on load, in the order a crew would put it up: poles,
 * then cable span by span, then the mark. It holds the last frame. With reduced
 * motion every transition has zero length and the finished plan is simply there.
 */

type Pole = { x: number; top: number; label: string; tilt?: number };

const GROUND = 270;

const POLES: Pole[] = [
  { x: 60, top: 88, label: "P470" },
  { x: 180, top: 92, label: "P471" },
  { x: 300, top: 84, label: "P472", tilt: -11 },
  { x: 420, top: 94, label: "P473" },
  { x: 515, top: 90, label: "P474" },
];

/** Crossarm height on a pole, where the cable hangs. */
const arm = (p: Pole) => p.top + 8;

/** One span between two poles, sagging at mid-span like a real cable. */
function span(a: Pole, b: Pole) {
  const mx = (a.x + b.x) / 2;
  const sag = Math.max(arm(a), arm(b)) + 30;
  return `M${a.x} ${arm(a)} Q${mx} ${sag} ${b.x} ${arm(b)}`;
}

const FLAGGED = POLES[2];

export function TramoPlan({ start = 0.35 }: { start?: number }) {
  const still = usePrefersReducedMotion();
  const narrow = useNarrow();
  const left = narrow ? 150 : 0;
  const label = narrow ? 13 : 11;
  const small = narrow ? 12.5 : 10.5;
  const box = narrow ? { x: 326, w: 228, h: 46 } : { x: 358, w: 196, h: 40 };
  const t = (delay: number, duration: number, ease: typeof EXPO | "easeOut" = EXPO) =>
    still ? { duration: 0 } : { delay: start + delay, duration, ease };

  const poleAt = (i: number) => 0.08 * i;
  const cableAt = (i: number) => 0.55 + 0.18 * i;
  const markAt = cableAt(POLES.length - 1) + 0.35;

  return (
    <svg
      viewBox={`${left} 0 ${560 - left} 340`}
      role="img"
      aria-label="Plano de un tramo de cinco postes, del P470 al P474. El P472 está marcado: criticidad 2, ferretería fuera de cruceta."
      className="block h-auto w-full"
      style={{ fontFamily: "var(--pp-mono)" }}
    >
      <line x1="10" y1={GROUND} x2="550" y2={GROUND} stroke="var(--pp-ink)" strokeWidth="1.5" />
      <line
        x1="10"
        y1={GROUND + 6}
        x2="550"
        y2={GROUND + 6}
        stroke="var(--pp-ink)"
        strokeOpacity="0.35"
        strokeDasharray="2 6"
      />

      {POLES.slice(1).map((b, i) => (
        <motion.path
          key={b.label}
          d={span(POLES[i], b)}
          fill="none"
          stroke="var(--pp-ink)"
          strokeWidth="1.4"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={t(cableAt(i), 0.7)}
        />
      ))}

      {POLES.map((p, i) => (
        <motion.g
          key={p.label}
          fill="var(--pp-ink)"
          style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={t(poleAt(i), 0.7)}
        >
          <rect x={p.x - 2} y={p.top} width="4" height={GROUND - p.top} />
          <rect
            x={p.x - 16}
            y={arm(p)}
            width="32"
            height="3"
            transform={p.tilt ? `rotate(${p.tilt} ${p.x} ${arm(p) + 1})` : undefined}
          />
        </motion.g>
      ))}

      <g fontSize={label} textAnchor="middle">
        {POLES.map((p, i) => (
          <motion.text
            key={p.label}
            x={p.x}
            y={GROUND + 24}
            fill={p === FLAGGED ? "var(--pp-ink)" : "var(--pp-dim)"}
            fontWeight={p === FLAGGED ? 500 : 400}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={t(0.45 + 0.05 * i, 0.4, "easeOut")}
          >
            {p.label}
          </motion.text>
        ))}
      </g>
      <motion.text
        x={left + 10}
        y="322"
        fontSize={small}
        fill="var(--pp-dim)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={t(0.7, 0.5, "easeOut")}
      >
        TRAMO COROICO › CORIPATA · VANO MEDIO 58 m
      </motion.text>

      {/* the mark: a ring that goes out once, the dot, and the callout */}
      <motion.circle
        cx={FLAGGED.x}
        cy={FLAGGED.top - 6}
        r="9"
        fill="none"
        stroke="var(--pp-or)"
        strokeWidth="2"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={still ? { scale: 1, opacity: 0 } : { scale: [0.4, 2.6], opacity: [0.9, 0] }}
        transition={t(markAt + 0.15, 1.1)}
      />
      <motion.circle
        cx={FLAGGED.x}
        cy={FLAGGED.top - 6}
        r="7"
        fill="var(--pp-or)"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={t(markAt, 0.45)}
      />
      <motion.polyline
        points={`${FLAGGED.x + 9},${FLAGGED.top - 12} ${box.x - 22},34 ${box.x - 2},34`}
        fill="none"
        stroke="var(--pp-or)"
        strokeWidth="1.2"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={t(markAt + 0.2, 0.45)}
      />
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={t(markAt + 0.4, 0.45, "easeOut")}
      >
        <rect x={box.x} y="16" width={box.w} height={box.h} fill="var(--pp-paper)" stroke="var(--pp-or)" strokeWidth="1.2" />
        <text x={box.x + 10} y={narrow ? 35 : 32} fontSize={small} fontWeight="500" fill="var(--pp-or-ink)">
          P472 · CRITICIDAD 2
        </text>
        <text x={box.x + 10} y={narrow ? 53 : 47} fontSize={small} fill="var(--pp-ink)">
          Ferretería fuera de cruceta
        </text>
      </motion.g>
    </svg>
  );
}
