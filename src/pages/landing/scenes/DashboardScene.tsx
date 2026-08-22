import { useRef } from "react";
import { motion } from "motion/react";
import { ArrowDownIcon, ArrowUpIcon, CalendarDaysIcon, ChevronDownIcon } from "lucide-react";
import { Counter, Cursor, ScreenHead } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../stage-targets";
import { DASH_SCRIPT, beatOf, pressCount } from "../scripts";

/**
 * Scene three: the operating picture.
 *
 * The point being made is not "we have charts". It is that the period control
 * changes everything at once — five totals and the whole series — because the
 * numbers are read from the same records the technicians filed in scene two,
 * not typed into a slide the night before a meeting.
 */



const PERIODS = ["15 días", "Este mes", "3 meses", "Este año", "Todo"];

const KPIS = {
  fortnight: [
    { label: "Creados", value: 128, delta: 12.4, good: "up" },
    { label: "Revisados", value: 96, delta: 8.1, good: "up" },
    { label: "Solucionados", value: 74, delta: 15.2, good: "up" },
    { label: "Pendientes", value: 38, delta: -9.6, good: "down" },
  ],
  month: [
    { label: "Creados", value: 271, delta: 18.9, good: "up" },
    { label: "Revisados", value: 214, delta: 11.3, good: "up" },
    { label: "Solucionados", value: 183, delta: 22.7, good: "up" },
    { label: "Pendientes", value: 52, delta: -4.2, good: "down" },
  ],
} as const;

const SERIES = {
  fortnight: {
    created: [6, 9, 5, 12, 8, 14, 11, 7, 13, 16, 9, 12, 10, 15],
    solved: [3, 6, 4, 8, 6, 9, 8, 5, 9, 12, 7, 9, 8, 11],
    labels: ["7 ago", "10 ago", "13 ago", "16 ago", "19 ago"],
  },
  month: {
    created: [4, 8, 6, 11, 7, 13, 9, 15, 10, 6, 12, 8, 14, 9, 17, 11, 7, 13, 16, 10, 8, 14, 12, 18, 9, 15, 11, 13, 16, 12],
    solved: [2, 5, 4, 7, 5, 9, 6, 11, 7, 4, 8, 6, 10, 6, 12, 8, 5, 9, 11, 7, 6, 10, 9, 13, 6, 11, 8, 9, 12, 9],
    labels: ["1 ago", "7 ago", "13 ago", "19 ago", "25 ago"],
  },
} as const;

const TOP_POSTES = [
  { id: "P-0611", tramo: "Tramo Sur", n: 7 },
  { id: "P-0472", tramo: "Tramo Norte", n: 5 },
  { id: "P-0295", tramo: "Tramo Centro", n: 4 },
];

const CRITICOS = [
  { id: "EV-2289", obs: "Catastrófico", dias: 3, color: "oklch(0.655 0.205 25)" },
  { id: "EV-2276", obs: "Daño estructural", dias: 6, color: "oklch(0.80 0.15 85)" },
];

const CHART_W = 808;
const CHART_H = 146;

function Chart({ period, hinted, still }: { period: "fortnight" | "month"; hinted: boolean; still: boolean }) {
  const { created, solved, labels } = SERIES[period];
  const n = created.length;
  const max = Math.max(...created) * 1.15;
  const slot = CHART_W / n;
  const barW = Math.min(18, slot * 0.5);

  const y = (v: number) => CHART_H - (v / max) * CHART_H;
  const line = solved
    .map((v, i) => `${i === 0 ? "M" : "L"} ${slot * i + slot / 2} ${y(v)}`)
    .join(" ");
  const area = `${line} L ${slot * (n - 1) + slot / 2} ${CHART_H} L ${slot / 2} ${CHART_H} Z`;

  const hintIndex = period === "fortnight" ? 6 : 19;
  const hintValue = created[hintIndex] ?? 0;
  const hintSolved = solved[hintIndex] ?? 0;

  return (
    <div className="relative">
      <motion.div
        key={period}
        initial={still ? false : { clipPath: "inset(0 100% 0 0)" }}
        animate={{ clipPath: "inset(0 0% 0 0)" }}
        transition={{ duration: 1.15, ease: [0.33, 1, 0.68, 1] }}
      >
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-[146px] w-full" preserveAspectRatio="none">
          <defs>
            <linearGradient id="solvedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.745 0.135 162)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="oklch(0.745 0.135 162)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2={CHART_W}
              y1={CHART_H * (1 - f)}
              y2={CHART_H * (1 - f)}
              stroke="oklch(0.262 0.013 258)"
              strokeWidth="1"
            />
          ))}

          {created.map((v, i) => (
            <rect
              key={i}
              x={slot * i + (slot - barW) / 2}
              y={y(v)}
              width={barW}
              height={CHART_H - y(v)}
              rx="2.5"
              fill={i === hintIndex && hinted ? "oklch(0.72 0.115 258)" : "oklch(0.545 0.095 258)"}
            />
          ))}

          <path d={area} fill="url(#solvedFill)" />
          <path d={line} fill="none" stroke="oklch(0.745 0.135 162)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      </motion.div>

      <div className="mt-2 flex justify-between px-1 text-[9.5px] text-[var(--scr-faint)]">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>

      {/* the bar the pointer rests on */}
      <div
        data-target="dash-bar"
        className="absolute"
        style={{
          left: `${((slot * hintIndex + slot / 2) / CHART_W) * 100}%`,
          top: (y(hintValue) / CHART_H) * 146,
          width: 1,
          height: 1,
        }}
      />
      <motion.div
        className="pointer-events-none absolute z-20 ml-3.5 w-[124px] rounded-lg border border-[var(--scr-line)] bg-[var(--scr-raise)] px-2.5 py-2 shadow-[0_16px_36px_-16px_oklch(0_0_0/0.9)]"
        style={{
          left: `${((slot * hintIndex + slot / 2) / CHART_W) * 100}%`,
          top: (y(hintValue) / CHART_H) * 146 - 62,
        }}
        initial={false}
        animate={hinted ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 6, scale: 0.96 }}
        transition={{ duration: 0.28, ease: EXPO }}
      >
        <p className="text-[9.5px] text-[var(--scr-faint)]">{period === "fortnight" ? "13 ago 2026" : "20 ago 2026"}</p>
        <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-[var(--scr-text)]">
          <span className="h-[6px] w-[6px] rounded-sm bg-[oklch(0.545_0.095_258)]" />
          Creados <span className="ml-auto font-semibold">{hintValue}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-[var(--scr-text)]">
          <span className="h-[6px] w-[6px] rounded-sm bg-[var(--scr-ok)]" />
          Resueltos <span className="ml-auto font-semibold">{hintSolved}</span>
        </div>
      </motion.div>
    </div>
  );
}

export function DashboardScene({ step, still }: { step: number; still: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const beat = beatOf(DASH_SCRIPT, step);
  const pos = useTargetBox(root, beat.target, step);

  const dropdown = step === 3;
  const period = step >= 4 ? "month" : "fortnight";
  const hinted = step >= 5;
  const kpis = KPIS[period];

  return (
    <div ref={root} className="relative h-full w-full">
      <ScreenHead
        title="Dashboard"
        sub="Resumen operativo de postes y eventos en el sistema"
        right={
          <div className="relative mt-0.5">
            <div
              data-target="dash-period"
              className={`flex h-[26px] items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors duration-200 ${
                dropdown ? "border-[var(--scr-primary)] text-[var(--scr-text)]" : "border-[var(--scr-hair)] text-[var(--scr-dim)]"
              }`}
            >
              <CalendarDaysIcon className="h-3 w-3" />
              {period === "month" ? "Este mes" : "15 días"}
              <ChevronDownIcon className="h-3 w-3 opacity-60" />
            </div>
            <motion.div
              className="absolute top-[30px] right-0 z-30 w-[112px] overflow-hidden rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)]"
              initial={false}
              animate={dropdown ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EXPO }}
            >
              {PERIODS.map((p) => (
                <div
                  key={p}
                  data-target={p === "Este mes" ? "dash-month" : undefined}
                  className={`flex h-[24px] items-center px-2.5 text-[10.5px] ${
                    p === "15 días" ? "text-[var(--scr-text)]" : "text-[var(--scr-dim)]"
                  }`}
                >
                  {p}
                </div>
              ))}
            </motion.div>
          </div>
        }
      />

      <div className="absolute inset-x-6 top-[76px] bottom-6">
        {/* totals */}
        <div className="grid grid-cols-[236px_repeat(4,1fr)] gap-3">
          <motion.div
            className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-4 py-3"
            initial={still ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: EXPO }}
          >
            <p className="text-[10px] tracking-wider text-[var(--scr-faint)] uppercase">Postes en la red</p>
            <div className="mt-1.5 flex items-end justify-between">
              <p className="text-[30px] leading-none font-bold text-[var(--scr-text)]">
                <Counter to={1661} still={still} duration={1.5} />
              </p>
              <svg viewBox="0 0 96 30" className="h-[30px] w-[96px]">
                <path
                  d="M0 26 L12 22 L24 24 L36 17 L48 19 L60 12 L72 14 L84 7 L96 4"
                  fill="none"
                  stroke="oklch(0.745 0.135 162)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="mt-2 text-[10px] text-[var(--scr-faint)]">99 ciudades · 12 tramos activos</p>
          </motion.div>

          {kpis.map((kpi, i) => {
            const rising = kpi.delta > 0;
            const healthy = (kpi.good === "up") === rising;
            const tone = healthy ? "var(--scr-ok)" : "var(--scr-warn)";
            return (
              <motion.div
                key={kpi.label}
                className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-3 py-3"
                initial={still ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EXPO, delay: still ? 0 : 0.07 * (i + 1) }}
              >
                <p className="text-[10px] tracking-wider text-[var(--scr-faint)] uppercase">{kpi.label}</p>
                <p className="mt-1.5 text-[24px] leading-none font-bold text-[var(--scr-text)]">
                  <Counter to={kpi.value} still={still} duration={1.2} />
                </p>
                <p className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: tone }}>
                  {rising ? <ArrowUpIcon className="h-2.5 w-2.5" /> : <ArrowDownIcon className="h-2.5 w-2.5" />}
                  {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* activity */}
        <div className="mt-3 rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-4 pt-3 pb-2.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-[var(--scr-text)]">Actividad de eventos</p>
            <div className="flex items-center gap-3 text-[10px] text-[var(--scr-faint)]">
              <span className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-sm bg-[oklch(0.545_0.095_258)]" />
                Creados
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-[10px] rounded-full bg-[var(--scr-ok)]" />
                Resueltos
              </span>
            </div>
          </div>
          <Chart period={period} hinted={hinted} still={still} />
        </div>

        {/* two short lists */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-4 py-2.5">
            <p className="text-[11.5px] font-semibold text-[var(--scr-text)]">Postes con más incidencias</p>
            <div className="mt-1.5">
              {TOP_POSTES.map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-[3px] text-[10.5px]">
                  <span className="w-[46px] font-medium text-[var(--scr-text)]">{p.id}</span>
                  <span className="flex-1 text-[var(--scr-faint)]">{p.tramo}</span>
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--scr-raise)]">
                    <span
                      className="block h-full rounded-full bg-[var(--scr-warn)]"
                      style={{ width: `${(p.n / 7) * 100}%` }}
                    />
                  </span>
                  <span className="w-[10px] text-right font-semibold text-[var(--scr-dim)]">{p.n}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-4 py-2.5">
            <p className="text-[11.5px] font-semibold text-[var(--scr-text)]">Críticos sin resolver</p>
            <div className="mt-1.5">
              {CRITICOS.map((c) => (
                <div key={c.id} className="flex items-center gap-2 py-[4px] text-[10.5px]">
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: c.color }} />
                  <span className="w-[54px] font-medium text-[var(--scr-text)]">{c.id}</span>
                  <span className="flex-1 text-[var(--scr-faint)]">{c.obs}</span>
                  <span className="text-[var(--scr-dim)]">{c.dias} días abiertos</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Cursor x={pos.x} y={pos.y} press={pressCount(DASH_SCRIPT, step)} hidden={still || step < 2} />
    </div>
  );
}
