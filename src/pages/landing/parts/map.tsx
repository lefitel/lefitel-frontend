import { useEffect, useMemo } from "react";
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react";
import { ArrowRightIcon, LayersIcon } from "lucide-react";
import { Counter, Cursor, Panel } from "../chrome";
import { EXPO, asText } from "../tokens";
import { useTargetBox } from "../targets";
import { CARD_SCRIPT, FILTER_SCRIPT, PLAN_SCRIPT, beatOf, pressCount } from "../scripts";
import { usePart } from "../usePart";
import { useNarrow } from "../useNarrow";
import { EVENT, NETWORK, POLE } from "./fiction";
import { FLAGGED, LAYERS, PLAN, POLES, type PoleState } from "./coroico";

/**
 * The three pieces that come from the operations map: the network on a plan,
 * one pole opened, and the view narrowed to what still needs a crew.
 */

type PinState = PoleState;

const PIN_COLOR: Record<PinState, string> = {
  crit: "var(--scr-crit)",
  warn: "var(--scr-warn)",
  ok: "var(--scr-ok)",
  idle: "oklch(0.52 0.015 258)",
};

const seeded = (seed: number) => {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
};

// ── The plan itself ──────────────────────────────────────────────────────────

/**
 * Coroico, painted the way the application paints its map.
 *
 * Two earlier versions drew an invented city: a lattice of rectangles, then
 * paved ground with blocks cut out of it. Neither read as a map, because a
 * real town is not a grid. This one is the real street plan of Coroico, where
 * the tramo the section follows begins, taken from OpenStreetMap by
 * `scripts/build-landing-map.mjs` and filled with the colours of the
 * application's own dark style (`public/map-styles/basic-dark.json`): what a
 * client sees here is what the map looks like when they log in.
 *
 * It is still a drawing, not a map widget. No tiles are fetched, so the public
 * page makes no third-party request to decorate a section, and the plan scales
 * by cropping (`slice`) rather than stretching, so streets keep their angles at
 * any panel shape.
 */
const STYLE = {
  ground: "var(--map-ground)",
  fields: "var(--map-fields)",
  green: "var(--map-green)",
  residential: "var(--map-residential)",
  water: "var(--map-water)",
  building: "var(--map-building)",
  buildingLine: "var(--map-building-line)",
  minor: "var(--map-minor)",
  major: "var(--map-road)",
  casing: "var(--map-casing)",
  label: "var(--map-label)",
  halo: "var(--map-halo)",
};

function Streets() {
  return (
    <>
      <rect x={-PLAN.w} y={-PLAN.h} width={PLAN.w * 3} height={PLAN.h * 3} fill={STYLE.ground} />
      <path d={LAYERS.fields} fill={STYLE.fields} />
      <path d={LAYERS.green} fill={STYLE.green} opacity="0.75" />
      <path d={LAYERS.residential} fill={STYLE.residential} />
      <path d={LAYERS.pools} fill={STYLE.water} />
      <path
        d={LAYERS.buildings}
        fill={STYLE.building}
        stroke={STYLE.buildingLine}
        strokeWidth="0.35"
      />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={LAYERS.paths} stroke={STYLE.minor} strokeWidth="0.7" strokeDasharray="1.6 1.4" />
        {/* A casing under the roads: the light style's white streets on
            beige need an edge to be seen, and in the dark style the casing is
            the ground colour, so it disappears. */}
        <path d={LAYERS.minor} stroke={STYLE.casing} strokeWidth="3.6" />
        <path d={LAYERS.major} stroke={STYLE.casing} strokeWidth="5.4" />
        <path d={LAYERS.minor} stroke={STYLE.minor} strokeWidth="2.6" />
        <path d={LAYERS.major} stroke={STYLE.major} strokeWidth="4.2" />
      </g>
    </>
  );
}

/** The town's name, set the way the map style sets a place label. */
function PlaceLabel({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={size}
      fontWeight={600}
      letterSpacing="0.04em"
      fill={STYLE.label}
      stroke={STYLE.halo}
      strokeWidth={size * 0.28}
      paintOrder="stroke"
      style={{ fontFamily: "'Geist Variable', sans-serif" }}
    >
      Coroico
    </text>
  );
}

/**
 * A pole on the plan. Pending and critical ones carry a soft halo so they
 * stand out of the solved majority the way they do in the application.
 *
 * The radius is a motion value because the pole card zooms the plan: its pins
 * have to keep their size on screen while the ground grows under them. On the
 * still plan it simply never changes.
 */
function Pin({
  x,
  y,
  state,
  delay,
  still,
  radius,
  pulses = 0,
}: {
  x: number;
  y: number;
  state: PinState;
  delay: number;
  still: boolean;
  radius: MotionValue<number>;
  pulses?: number;
}) {
  const color = PIN_COLOR[state];
  const loud = state === "crit" || state === "warn";
  const halo = useTransform(radius, (r) => r * 2.3);
  const line = useTransform(radius, (r) => r * 0.42);

  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "center" }}
      initial={still ? false : { scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: EXPO, delay: still ? 0 : delay }}
    >
      {loud && <motion.circle cx={x} cy={y} r={halo} fill={color} opacity="0.18" />}
      {pulses > 0 && !still && (
        <motion.circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={line}
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: [1, 3.4], opacity: [0.8, 0] }}
          transition={{
            duration: 1.6,
            ease: "easeOut",
            delay: delay + 0.4,
            repeat: pulses - 1,
            repeatDelay: 0.5,
          }}
        />
      )}
      <motion.circle
        cx={x}
        cy={y}
        r={radius}
        fill={color}
        stroke={STYLE.ground}
        strokeWidth={line}
      />
    </motion.g>
  );
}

/** Where on the plan the reveal starts: the pole the section follows. */
const ORIGIN = POLES[FLAGGED] ?? { x: PLAN.w / 2, y: PLAN.h / 2 };
const FARTHEST = Math.max(...POLES.map((p) => Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y)));

/** Small print on the plan, styled like the map's own controls. */
function MapBadge({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`absolute flex items-center gap-1.5 rounded-md border border-[var(--scr-hair)] bg-[color-mix(in_oklch,var(--scr-panel)_90%,transparent)] px-2 py-1 text-[9.5px] text-[var(--scr-faint)] tabular-nums ${className}`}
    >
      {children}
    </div>
  );
}

// ── 1 · the network on the plan ──────────────────────────────────────────────

const LEGEND = [
  { s: "crit" as const, label: "Críticos", value: NETWORK.crit },
  { s: "warn" as const, label: "Pendientes", value: NETWORK.warn },
  { s: "ok" as const, label: "Solucionados", value: NETWORK.ok },
  { s: "idle" as const, label: "Sin eventos", value: NETWORK.idle },
];

/**
 * The plan arrives the way a map loads: the ground fades in while the camera
 * settles a few per cent closer, then the poles come up as a wave spreading
 * out from the P472, so the reader's eye is already on the pole the next piece
 * opens. Critical poles ring twice and then hold still; a page where eleven
 * things loop forever is a fairground.
 */
export function PlanPart() {
  const { ref, still, onScreen } = usePart<HTMLDivElement>(PLAN_SCRIPT);
  const shown = onScreen || still;
  const pinR = useMotionValue(3.8);
  const flaggedR = useMotionValue(5);

  return (
    <div ref={ref}>
      <Panel className="relative aspect-[4/3] overflow-hidden sm:aspect-[2/1]">
        <motion.div
          className="absolute inset-0"
          initial={still ? false : { opacity: 0, scale: 1.07 }}
          animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.07 }}
          transition={{ duration: 1.3, ease: EXPO }}
        >
          <svg
            viewBox={`0 0 ${PLAN.w} ${PLAN.h}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <Streets />
            <PlaceLabel x={ORIGIN.x + 110} y={ORIGIN.y - 85} size={15} />
            {shown &&
              POLES.map((p, i) => (
                <Pin
                  key={i}
                  x={p.x}
                  y={p.y}
                  state={p.s}
                  still={still}
                  radius={i === FLAGGED ? flaggedR : pinR}
                  delay={0.45 + (Math.hypot(p.x - ORIGIN.x, p.y - ORIGIN.y) / FARTHEST) * 0.9}
                  pulses={p.s === "crit" ? 2 : 0}
                />
              ))}
          </svg>
        </motion.div>

        <div className="absolute top-3 left-3 rounded-lg border border-[var(--scr-hair)] bg-[color-mix(in_oklch,var(--scr-panel)_92%,transparent)] px-3 py-2">
          {LEGEND.map((row) => (
            <div key={row.s} className="flex items-center gap-2 py-[3px] text-[10.5px]">
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: PIN_COLOR[row.s] }}
              />
              <span className="w-[74px] text-[var(--scr-dim)]">{row.label}</span>
              <span className="w-[38px] text-right font-semibold text-[var(--scr-text)]">
                <Counter to={shown ? row.value : 0} still={still} duration={1.4} />
              </span>
            </div>
          ))}
        </div>

        <MapBadge className="bottom-3 left-3">
          {PLAN.lat.toFixed(4).replace("-", "−")}, {PLAN.lon.toFixed(4).replace("-", "−")}
        </MapBadge>
        <MapBadge className="right-3 bottom-3">
          <LayersIcon className="h-2.5 w-2.5" />
          Bolivia · {NETWORK.cities} ciudades
        </MapBadge>
        <p className="absolute top-2 right-3 text-[8.5px] text-[var(--scr-faint)]/80">
          © OpenStreetMap
        </p>
      </Panel>
    </div>
  );
}

// ── 2 · one pole, opened ─────────────────────────────────────────────────────

/**
 * The camera's two framings: the whole town, and the street the pole stands
 * on. The card's panel is three by two, so both are; a different panel shape
 * only crops the edges.
 */
const WIDE = { x: PLAN.w / 2, y: PLAN.h / 2, w: 630 };
const CLOSE = { x: ORIGIN.x + 60, y: ORIGIN.y + 26, w: 330 };
/** On a phone the card spans the panel's width, so the pole goes to the top. */
const CLOSE_NARROW = { x: ORIGIN.x, y: ORIGIN.y + 78, w: 330 };
/** Pin radius at the close framing, in plan units. */
const PIN_R = 4.2;

const FICHA = [
  ["Propietario", POLE.owner],
  ["Material", POLE.material],
  ["Fecha de instalación", POLE.installed],
  ["Última revisión", POLE.lastCheck],
];

/**
 * A flight from the town to the P472, then its card.
 *
 * One motion value drives the camera from 0 (whole town) to 1 (the pole's
 * street). The width eases on a log scale, which is how a map zoom feels, and
 * the pins are resized against it so they stay the same size on screen while
 * the streets grow under them. When the camera lands the pole rings like the
 * application's selected marker, and the card opens.
 */
export function CardPart() {
  const { ref, step, still, onScreen } = usePart<HTMLDivElement>(CARD_SCRIPT);
  const open = step >= 1;
  const zoom = useMotionValue(still ? 1 : 0);
  const close = useNarrow() ? CLOSE_NARROW : CLOSE;

  useEffect(() => {
    if (still) {
      zoom.set(1);
      return;
    }
    if (!onScreen) return;
    const controls = animate(zoom, 1, {
      duration: 1.5,
      ease: [0.65, 0, 0.35, 1],
    });
    return () => controls.stop();
  }, [onScreen, still, zoom]);

  const width = useTransform(zoom, (z) => WIDE.w * Math.pow(close.w / WIDE.w, z));
  const viewBox = useTransform(zoom, (z) => {
    const w = WIDE.w * Math.pow(close.w / WIDE.w, z);
    const h = (w * 2) / 3;
    const x = WIDE.x + (close.x - WIDE.x) * z;
    const y = WIDE.y + (close.y - WIDE.y) * z;
    return `${x - w / 2} ${y - h / 2} ${w} ${h}`;
  });
  const radius = useTransform(width, (w) => (PIN_R * w) / close.w);
  const flaggedR = useTransform(radius, (r) => r * 1.45);
  const shown = onScreen || still;

  // Only the poles near the pole's street matter once the camera lands; the
  // rest are drawn while it is still wide, then simply leave the frame.
  const pins = useMemo(
    () => POLES.map((p, i) => ({ ...p, i })).filter((p) => Math.abs(p.x - ORIGIN.x) < 360),
    [],
  );

  return (
    <div ref={ref}>
      <Panel className="relative aspect-[5/4] overflow-hidden sm:aspect-[3/2]">
        <motion.svg
          viewBox={viewBox}
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <Streets />
          {shown &&
            pins.map((p) => (
              <Pin
                key={p.i}
                x={p.x}
                y={p.y}
                state={p.i === FLAGGED ? "warn" : p.s}
                still={still}
                radius={p.i === FLAGGED ? flaggedR : radius}
                delay={p.i === FLAGGED ? 1.2 : 0.05}
                pulses={p.i === FLAGGED ? 2 : 0}
              />
            ))}
        </motion.svg>

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
                color: asText(EVENT.obs.color),
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
