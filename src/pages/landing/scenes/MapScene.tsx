import { useRef } from "react";
import { motion } from "motion/react";
import { ArrowRightIcon, LayersIcon } from "lucide-react";
import { Counter, Cursor, ScreenHead } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../stage-targets";
import { MAP_SCRIPT, beatOf, pressCount } from "../scripts";

/**
 * Scene one: the operations map.
 *
 * Poles land on the plan, one is opened, then the view is filtered down to what
 * still needs a crew. It runs first because it is the only screen a stranger
 * understands without being told what the company does.
 *
 * Every figure here is invented and every pole belongs to nobody: the page is
 * public, and a defect pinned to a named operator is that operator's business,
 * not a decoration for a landing page.
 */



type PinState = "crit" | "warn" | "ok" | "idle";

const PIN_COLOR: Record<PinState, string> = {
  crit: "var(--scr-crit)",
  warn: "var(--scr-warn)",
  ok: "var(--scr-ok)",
  idle: "oklch(0.46 0.015 258)",
};

/** Sample of the network drawn on the plan. Pending work stays visible when filtered. */
const PINS: { x: number; y: number; s: PinState }[] = [
  { x: 96, y: 74, s: "ok" },
  { x: 152, y: 61, s: "warn" },
  { x: 214, y: 89, s: "ok" },
  { x: 268, y: 66, s: "idle" },
  { x: 331, y: 93, s: "ok" },
  { x: 392, y: 70, s: "crit" },
  { x: 456, y: 85, s: "ok" },
  { x: 519, y: 62, s: "idle" },
  { x: 578, y: 91, s: "ok" },
  { x: 641, y: 69, s: "warn" },
  { x: 706, y: 87, s: "ok" },
  { x: 128, y: 177, s: "warn" },
  { x: 197, y: 209, s: "ok" },
  { x: 263, y: 171, s: "ok" },
  { x: 318, y: 225, s: "idle" },
  { x: 387, y: 185, s: "ok" },
  { x: 455, y: 214, s: "warn" },
  { x: 524, y: 179, s: "ok" },
  { x: 589, y: 221, s: "idle" },
  { x: 653, y: 183, s: "ok" },
  { x: 719, y: 217, s: "crit" },
  { x: 111, y: 319, s: "ok" },
  { x: 175, y: 357, s: "idle" },
  { x: 243, y: 321, s: "warn" },
  { x: 309, y: 365, s: "ok" },
  { x: 373, y: 327, s: "ok" },
  { x: 439, y: 369, s: "idle" },
  { x: 507, y: 331, s: "crit" },
  { x: 573, y: 373, s: "ok" },
  { x: 639, y: 335, s: "ok" },
  { x: 703, y: 367, s: "warn" },
  { x: 763, y: 301, s: "ok" },
];

/** The one the cursor opens. */
const PICKED = 16;

const LEGEND = [
  { s: "crit" as const, label: "Críticos", value: 10 },
  { s: "warn" as const, label: "Pendientes", value: 138 },
  { s: "ok" as const, label: "Solucionados", value: 1386 },
  { s: "idle" as const, label: "Sin eventos", value: 127 },
];

const FICHA = [
  ["Propietario", "Operadora regional"],
  ["Material", "Hormigón armado"],
  ["Altura", "11,5 m"],
  ["Última revisión", "14 ago 2026"],
];

/**
 * A city, drawn rather than tiled.
 *
 * The first version was streets on an empty ground and it read as graph paper:
 * a real plan is mostly blocks, and the streets are the gaps between them. So
 * the ground is paved and the blocks are cut out of it, with irregular spacing
 * from a fixed seed so no two rows line up into a lattice. No map tiles are
 * fetched, which keeps the public page free of a third-party request made only
 * to decorate a section.
 */
const GROUND = "oklch(0.248 0.013 258)";
const BLOCK = "oklch(0.196 0.013 258)";

const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
};

const BLOCKS = (() => {
  const rnd = seeded(20260821);
  const xs = [0, 62, 128, 196, 268, 348, 420, 496, 566, 640, 712, 782, 840];
  const ys = [0, 58, 118, 176, 238, 300, 356, 412, 442];
  const out: { x: number; y: number; w: number; h: number; park: boolean }[] = [];

  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const roll = rnd();
      if (roll < 0.055) continue; // an empty lot here and there
      const pad = 3 + rnd() * 2.4;
      out.push({
        x: (xs[i] ?? 0) + pad,
        y: (ys[j] ?? 0) + pad,
        w: (xs[i + 1] ?? 0) - (xs[i] ?? 0) - pad * 2,
        h: (ys[j + 1] ?? 0) - (ys[j] ?? 0) - pad * 2,
        park: roll > 0.978,
      });
    }
  }
  return out;
})();

function CityPlan() {
  return (
    <svg viewBox="0 0 840 442" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="840" height="442" fill={GROUND} />

      {BLOCKS.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx="2"
          fill={b.park ? "oklch(0.232 0.017 158)" : BLOCK}
        />
      ))}

      {/* main roads, cut back through the blocks */}
      <g stroke={GROUND} strokeLinecap="square">
        <path d="M0 88 H840" strokeWidth="13" />
        <path d="M0 208 H840" strokeWidth="13" />
        <path d="M0 328 H840" strokeWidth="11" />
        <path d="M158 0 V442" strokeWidth="13" />
        <path d="M462 0 V442" strokeWidth="13" />
        <path d="M676 0 V442" strokeWidth="11" />
        <path d="M0 404 L840 116" strokeWidth="15" />
      </g>
      <g stroke="oklch(0.30 0.014 258)" strokeWidth="1" opacity="0.8">
        <path d="M0 88 H840" />
        <path d="M0 208 H840" />
        <path d="M158 0 V442" />
        <path d="M462 0 V442" />
      </g>

      <path
        d="M0 268 C 160 302, 300 238, 440 266 S 700 322, 840 284"
        fill="none"
        stroke="oklch(0.375 0.055 232)"
        strokeWidth="17"
        strokeLinecap="round"
      />
      <path
        d="M0 268 C 160 302, 300 238, 440 266 S 700 322, 840 284"
        fill="none"
        stroke="oklch(0.46 0.07 230)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />

      <g opacity="0.6">
        <path d="M694 424 H778" stroke="oklch(0.62 0.012 258)" strokeWidth="1.4" />
        <path d="M694 420 V428 M778 420 V428" stroke="oklch(0.62 0.012 258)" strokeWidth="1.4" />
        <text x="736" y="416" fill="oklch(0.62 0.012 258)" fontSize="8.5" textAnchor="middle">
          500 m
        </text>
      </g>
    </svg>
  );
}

function Pin({
  pin,
  index,
  picked,
  open,
  hidden,
  still,
}: {
  pin: { x: number; y: number; s: PinState };
  index: number;
  picked: boolean;
  open: boolean;
  hidden: boolean;
  still: boolean;
}) {
  const color = PIN_COLOR[pin.s];
  const size = picked && open ? 15 : 11;

  return (
    <motion.div
      className="absolute"
      style={{ left: pin.x, top: pin.y }}
      initial={still ? false : { scale: 0, y: -12, opacity: 0 }}
      animate={{
        scale: 1,
        y: 0,
        opacity: hidden ? 0.09 : 1,
      }}
      transition={{
        duration: 0.55,
        ease: EXPO,
        delay: still ? 0 : index * 0.028,
        opacity: { duration: 0.45, ease: EXPO },
      }}
    >
      {pin.s === "crit" && !hidden && !still && (
        <motion.span
          className="absolute rounded-full"
          style={{
            left: -11,
            top: -11,
            width: 22,
            height: 22,
            border: `1.5px solid ${color}`,
          }}
          animate={{ scale: [0.55, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: index * 0.4 }}
        />
      )}
      <motion.span
        data-target={picked ? "map-pin" : undefined}
        className="block rounded-full"
        animate={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
        transition={{ duration: 0.34, ease: EXPO }}
        style={{
          background: color,
          border: "2px solid oklch(0.192 0.013 258)",
          boxShadow: pin.s === "crit" || pin.s === "warn" ? `0 0 12px -2px ${color}` : "none",
        }}
      />
    </motion.div>
  );
}

export function MapScene({ step, still }: { step: number; still: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const beat = beatOf(MAP_SCRIPT, step);
  const pos = useTargetBox(root, beat.target, step);

  const open = step >= 2 && step < 4;
  const filtered = step >= 4;
  const picked = PINS[PICKED];

  return (
    <div ref={root} className="relative h-full w-full">
      <ScreenHead
        title="Mapa de operaciones"
        sub={
          filtered
            ? "148 postes con trabajo pendiente en Santa Cruz"
            : "1.661 postes bajo inspección en 99 ciudades"
        }
        right={
          <div className="mt-0.5 flex items-center gap-2">
            <div className="flex h-[26px] items-center gap-1.5 rounded-lg border border-[var(--scr-hair)] px-2.5 text-[11px] text-[var(--scr-faint)]">
              <LayersIcon className="h-3 w-3" />
              Santa Cruz
            </div>
            <div data-target="tab-pendientes-wrap">
              <SegmentedTargets value={filtered ? "Pendientes" : "Postes"} />
            </div>
          </div>
        }
      />

      <div className="absolute inset-x-6 top-[76px] bottom-6 overflow-hidden rounded-xl border border-[var(--scr-hair)]">
        <CityPlan />

        {PINS.map((pin, i) => (
          <Pin
            key={i}
            pin={pin}
            index={i}
            picked={i === PICKED}
            open={open}
            hidden={filtered && pin.s !== "warn" && pin.s !== "crit"}
            still={still}
          />
        ))}

        {/* legend, doubling as the live count */}
        <div className="absolute top-3.5 left-3.5 rounded-lg border border-[var(--scr-hair)] bg-[oklch(0.192_0.013_258/0.92)] px-3 py-2.5">
          {LEGEND.map((row) => {
            const dropped = filtered && row.s !== "warn" && row.s !== "crit";
            return (
              <motion.div
                key={row.s}
                className="flex items-center gap-2 py-[3px] text-[10.5px]"
                animate={{ opacity: dropped ? 0.25 : 1 }}
                transition={{ duration: 0.4, ease: EXPO }}
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: PIN_COLOR[row.s] }} />
                <span className="w-[74px] text-[var(--scr-dim)]">{row.label}</span>
                <span className="w-[38px] text-right font-semibold text-[var(--scr-text)]">
                  <Counter to={row.value} still={still} duration={1.3} />
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute bottom-3.5 left-3.5 rounded-md border border-[var(--scr-hair)] bg-[oklch(0.192_0.013_258/0.9)] px-2 py-1 text-[9.5px] tracking-tight text-[var(--scr-faint)] tabular-nums">
          −17.7833, −63.1821
        </div>

        {/* the opened pole */}
        <motion.div
          className="absolute w-[254px] overflow-hidden rounded-xl border border-[var(--scr-line)] bg-[var(--scr-panel)] shadow-[0_24px_50px_-20px_oklch(0_0_0/0.9)]"
          style={{ left: picked.x + 20, top: picked.y - 58 }}
          initial={false}
          animate={
            open
              ? { opacity: 1, scale: 1, y: 0, pointerEvents: "auto" }
              : { opacity: 0, scale: 0.94, y: 8, pointerEvents: "none" }
          }
          transition={{ duration: open ? 0.42 : 0.24, ease: EXPO, delay: open && !still ? 0.12 : 0 }}
        >
          <div className="flex items-start justify-between gap-2 px-3.5 pt-3">
            <div>
              <p className="text-[13.5px] leading-none font-bold text-[var(--scr-text)]">P-0472</p>
              <p className="mt-1.5 text-[10.5px] text-[var(--scr-faint)]">Tramo Norte · Km 12,4</p>
            </div>
            <span
              className="rounded-md px-2 py-1 text-[9.5px] font-semibold"
              style={{
                color: "var(--scr-warn)",
                background: "oklch(0.755 0.155 62 / 0.14)",
                border: "1px solid oklch(0.755 0.155 62 / 0.3)",
              }}
            >
              Ferretería suelta
            </span>
          </div>

          <div className="mt-3 border-t border-[var(--scr-hair)] px-3.5 py-2.5">
            {FICHA.map(([k, v]) => (
              <div key={k} className="flex justify-between py-[3px] text-[10.5px]">
                <span className="text-[var(--scr-faint)]">{k}</span>
                <span className="text-[var(--scr-dim)]">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--scr-hair)] bg-[var(--scr-raise)] px-3.5 py-2">
            <span className="text-[10.5px] text-[var(--scr-warn)]">2 eventos pendientes</span>
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--scr-text)]">
              Ver ficha
              <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>
        </motion.div>
      </div>

      <Cursor x={pos.x} y={pos.y} press={pressCount(MAP_SCRIPT, step)} hidden={still || step === 0} />
    </div>
  );
}

/** The view switch, with the middle option marked so the cursor can find it. */
function SegmentedTargets({ value }: { value: string }) {
  const options = ["Postes", "Pendientes", "Solucionados"] as const;
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--scr-hair)] bg-[var(--scr-panel)] p-0.5">
      {options.map((option) => {
        const on = option === value;
        return (
          <div
            key={option}
            data-target={option === "Pendientes" ? "tab-pendientes" : undefined}
            className="relative px-2.5 py-1"
          >
            {on && (
              <motion.span
                layoutId="map-seg"
                className="absolute inset-0 rounded-md bg-[var(--scr-raise)]"
                transition={{ duration: 0.34, ease: EXPO }}
              />
            )}
            <span
              className={`relative text-[11px] font-medium transition-colors duration-200 ${
                on ? "text-[var(--scr-text)]" : "text-[var(--scr-faint)]"
              }`}
            >
              {option}
            </span>
          </div>
        );
      })}
    </div>
  );
}
