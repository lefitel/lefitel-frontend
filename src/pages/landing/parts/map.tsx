import { motion } from "motion/react";
import { ArrowRightIcon, LayersIcon } from "lucide-react";
import { Counter, Cursor, Panel } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../targets";
import { CARD_SCRIPT, FILTER_SCRIPT, PLAN_SCRIPT, beatOf, pressCount } from "../scripts";
import { usePart } from "../usePart";
import { EVENT, NETWORK, POLE } from "./fiction";

/**
 * The three pieces that come from the operations map: the network on a plan,
 * one pole opened, and the view narrowed to what still needs a crew.
 */

type PinState = "crit" | "warn" | "ok" | "idle";

const PIN_COLOR: Record<PinState, string> = {
  crit: "var(--scr-crit)",
  warn: "var(--scr-warn)",
  ok: "var(--scr-ok)",
  idle: "oklch(0.46 0.015 258)",
};

// ── The plan itself ──────────────────────────────────────────────────────────

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

function CityPlan({ viewBox = "0 0 840 442", scale = 1 }: { viewBox?: string; scale?: number }) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <rect x="0" y="0" width="840" height="442" fill={GROUND} />

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

      <g stroke={GROUND} strokeLinecap="square">
        <path d="M0 88 H840" strokeWidth={13 * scale} />
        <path d="M0 208 H840" strokeWidth={13 * scale} />
        <path d="M0 328 H840" strokeWidth={11 * scale} />
        <path d="M158 0 V442" strokeWidth={13 * scale} />
        <path d="M462 0 V442" strokeWidth={13 * scale} />
        <path d="M676 0 V442" strokeWidth={11 * scale} />
        <path d="M0 404 L840 116" strokeWidth={15 * scale} />
      </g>
      <g stroke="oklch(0.30 0.014 258)" strokeWidth={scale} opacity="0.8">
        <path d="M0 88 H840" />
        <path d="M0 208 H840" />
        <path d="M158 0 V442" />
        <path d="M462 0 V442" />
      </g>

      <path
        d="M0 268 C 160 302, 300 238, 440 266 S 700 322, 840 284"
        fill="none"
        stroke="oklch(0.375 0.055 232)"
        strokeWidth={17 * scale}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── 1 · the network on the plan ──────────────────────────────────────────────

/** Sample of the network. Positions are in the plan's own 840x442 space. */
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

const pct = (v: number, span: number, origin = 0) => `${((v - origin) / span) * 100}%`;

function Pin({
  x,
  y,
  state,
  index,
  still,
  size = 11,
  pulse = true,
}: {
  x: string;
  y: string;
  state: PinState;
  index: number;
  still: boolean;
  size?: number;
  pulse?: boolean;
}) {
  const color = PIN_COLOR[state];
  return (
    <motion.div
      className="absolute"
      style={{ left: x, top: y }}
      initial={still ? false : { scale: 0, y: -12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ duration: 0.55, ease: EXPO, delay: still ? 0 : index * 0.028 }}
    >
      {state === "crit" && pulse && !still && (
        <motion.span
          className="absolute rounded-full"
          style={{
            left: -size,
            top: -size,
            width: size * 2,
            height: size * 2,
            border: `1.5px solid ${color}`,
          }}
          animate={{ scale: [0.55, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut", delay: index * 0.4 }}
        />
      )}
      <span
        className="block rounded-full"
        style={{
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          background: color,
          border: "2px solid oklch(0.192 0.013 258)",
          boxShadow: state === "crit" || state === "warn" ? `0 0 12px -2px ${color}` : "none",
        }}
      />
    </motion.div>
  );
}

const LEGEND = [
  { s: "crit" as const, label: "Críticos", value: NETWORK.crit },
  { s: "warn" as const, label: "Pendientes", value: NETWORK.warn },
  { s: "ok" as const, label: "Solucionados", value: NETWORK.ok },
  { s: "idle" as const, label: "Sin eventos", value: NETWORK.idle },
];

export function PlanPart() {
  const { ref, still } = usePart<HTMLDivElement>(PLAN_SCRIPT);

  return (
    <div ref={ref}>
      <Panel className="relative aspect-[4/3] overflow-hidden sm:aspect-[2/1]">
        <CityPlan />

        {PINS.map((pin, i) => (
          <Pin
            key={i}
            x={pct(pin.x, 840)}
            y={pct(pin.y, 442)}
            state={pin.s}
            index={i}
            still={still}
          />
        ))}

        <div className="absolute top-3 left-3 rounded-lg border border-[var(--scr-hair)] bg-[oklch(0.192_0.013_258/0.92)] px-3 py-2">
          {LEGEND.map((row) => (
            <div key={row.s} className="flex items-center gap-2 py-[3px] text-[10.5px]">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: PIN_COLOR[row.s] }}
              />
              <span className="w-[74px] text-[var(--scr-dim)]">{row.label}</span>
              <span className="w-[38px] text-right font-semibold text-[var(--scr-text)]">
                <Counter to={row.value} still={still} duration={1.4} />
              </span>
            </div>
          ))}
        </div>

        <div className="absolute bottom-3 left-3 rounded-md border border-[var(--scr-hair)] bg-[oklch(0.192_0.013_258/0.9)] px-2 py-1 text-[9.5px] tracking-tight text-[var(--scr-faint)] tabular-nums">
          −17.7833, −63.1821
        </div>

        <div className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-md border border-[var(--scr-hair)] bg-[oklch(0.192_0.013_258/0.9)] px-2 py-1 text-[9.5px] text-[var(--scr-faint)]">
          <LayersIcon className="h-2.5 w-2.5" />
          Bolivia · {NETWORK.cities} ciudades
        </div>
      </Panel>
    </div>
  );
}

// ── 2 · one pole, opened ─────────────────────────────────────────────────────

/** A closer look at the streets around the pole the section follows. */
const CROP = { x: 400, y: 150, w: 286, h: 214 };
const CROP_PINS: { x: number; y: number; s: PinState }[] = [
  { x: 524, y: 179, s: "ok" },
  { x: 600, y: 172, s: "ok" },
  { x: 424, y: 330, s: "idle" },
  { x: 470, y: 300, s: "ok" },
  { x: 455, y: 214, s: "warn" },
];

const FICHA = [
  ["Propietario", POLE.owner],
  ["Material", POLE.material],
  ["Fecha de instalación", POLE.installed],
  ["Última revisión", POLE.lastCheck],
];

export function CardPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(CARD_SCRIPT);
  const open = step >= 1;

  return (
    <div ref={ref}>
      <Panel className="relative aspect-[5/4] overflow-hidden sm:aspect-[3/2]">
        <CityPlan viewBox={`${CROP.x} ${CROP.y} ${CROP.w} ${CROP.h}`} scale={0.42} />

        {CROP_PINS.map((pin, i) => (
          <Pin
            key={i}
            x={pct(pin.x, CROP.w, CROP.x)}
            y={pct(pin.y, CROP.h, CROP.y)}
            state={pin.s}
            index={i}
            still={still}
            size={pin.s === "warn" ? 15 : 11}
            pulse={false}
          />
        ))}

        <motion.div
          className="absolute right-3 bottom-3 left-3 overflow-hidden rounded-xl border border-[var(--scr-line)] bg-[var(--scr-panel)] shadow-[0_24px_50px_-20px_oklch(0_0_0/0.9)] sm:left-auto sm:w-[254px]"
          initial={still ? false : { opacity: 0, y: 14, scale: 0.96 }}
          animate={open ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 14, scale: 0.96 }}
          transition={{ duration: 0.45, ease: EXPO }}
        >
          <div className="px-3.5 pt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-[13.5px] leading-none font-bold text-[var(--scr-text)]">
                {POLE.id}
              </p>
              <p className="truncate text-[10.5px] text-[var(--scr-faint)]">{POLE.tramo}</p>
            </div>
            <span
              className="mt-2 inline-block rounded-md px-2 py-1 text-[9.5px] font-semibold whitespace-nowrap"
              style={{
                color: EVENT.obs.color,
                background: `color-mix(in oklch, ${EVENT.obs.color} 14%, transparent)`,
                border: `1px solid color-mix(in oklch, ${EVENT.obs.color} 30%, transparent)`,
              }}
            >
              {EVENT.obs.label}
            </span>
          </div>

          <div className="mt-3 border-t border-[var(--scr-hair)] px-3.5 py-2.5">
            {FICHA.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 py-[3px] text-[10.5px]">
                <span className="text-[var(--scr-faint)]">{k}</span>
                <span className="text-right text-[var(--scr-dim)]">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-[var(--scr-hair)] bg-[var(--scr-raise)] px-3.5 py-2">
            <span className="text-[10.5px] text-[var(--scr-warn)]">
              {POLE.openEvents} eventos pendientes
            </span>
            <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--scr-text)]">
              Ver ficha
              <ArrowRightIcon className="h-3 w-3" />
            </span>
          </div>
        </motion.div>
      </Panel>
    </div>
  );
}

// ── 3 · narrowing the view ───────────────────────────────────────────────────

/**
 * The network as a field of dots, one dot per twenty-odd poles.
 *
 * The proportions are kept honest: of sixty-six dots, one is critical and five
 * are pending, which is the same nine and a half per cent that 148 is of 1.541.
 * When the filter lands and sixty of them fade, the size of the remaining job
 * is what the reader takes away, and it is not exaggerated in our favour.
 */
const FIELD: PinState[] = [
  ...Array<PinState>(1).fill("crit"),
  ...Array<PinState>(5).fill("warn"),
  ...Array<PinState>(5).fill("idle"),
  ...Array<PinState>(55).fill("ok"),
];

/** Shuffled once with a fixed seed, so the colours are scattered, not banded. */
const SCATTER = (() => {
  const rnd = seeded(770422);
  const a = [...FIELD];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const ai = a[i] as PinState;
    a[i] = a[j] as PinState;
    a[j] = ai;
  }
  return a;
})();

export function FilterPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(FILTER_SCRIPT);
  const beat = beatOf(FILTER_SCRIPT, step);
  const pos = useTargetBox(ref, beat.target, step);
  const filtered = step >= 2;

  return (
    <div ref={ref} className="relative">
      <Panel className="px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5 rounded-lg border border-[var(--scr-hair)] bg-[var(--scr-bg)] p-0.5">
            {["Postes", "Pendientes", "Solucionados"].map((option) => {
              const on = option === (filtered ? "Pendientes" : "Postes");
              return (
                <div
                  key={option}
                  data-target={option === "Pendientes" ? "view-pendientes" : undefined}
                  className="relative px-2.5 py-1"
                >
                  {on && (
                    <motion.span
                      layoutId="view-seg"
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

          <p className="text-[11px] text-[var(--scr-dim)]">
            <span className="font-semibold text-[var(--scr-text)]">
              <Counter to={filtered ? NETWORK.open : NETWORK.total} still={still} duration={0.9} />
            </span>{" "}
            {filtered ? "con trabajo pendiente" : "postes en la red"}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-[repeat(22,minmax(0,1fr))] gap-y-2 sm:grid-cols-[repeat(11,minmax(0,1fr))]">
          {SCATTER.map((state, i) => {
            const dropped = filtered && state !== "warn" && state !== "crit";
            return (
              <motion.span
                key={i}
                className="h-[9px] w-[9px] justify-self-center rounded-full"
                style={{ background: PIN_COLOR[state] }}
                initial={still ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: dropped ? 0.16 : 1 }}
                transition={{
                  duration: 0.4,
                  ease: EXPO,
                  delay: still ? 0 : Math.min(i * 0.008, 0.5),
                }}
              />
            );
          })}
        </div>
      </Panel>

      <Cursor
        x={pos.x}
        y={pos.y}
        press={pressCount(FILTER_SCRIPT, step)}
        hidden={still || step === 0}
      />
    </div>
  );
}
