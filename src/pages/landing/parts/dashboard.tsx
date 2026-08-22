import { motion } from "motion/react";
import { ArrowDownIcon, ArrowUpIcon, CalendarDaysIcon, ChevronDownIcon } from "lucide-react";
import { Counter, Cursor, Panel } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../targets";
import {
  CHART_SCRIPT,
  CRITICALS_SCRIPT,
  KPI_SCRIPT,
  PERIOD_SCRIPT,
  beatOf,
  pressCount,
} from "../scripts";
import { usePart } from "../usePart";
import { CATASTROFICO, CRITICALS, NETWORK, SERIES, TOTALS } from "./fiction";

/**
 * The four pieces that come from the dashboard.
 *
 * They are ordered so the period switch makes sense: the totals and the chart
 * show the fortnight, which is what the screen opens on, and the switch piece
 * is the one that moves them to the month. A piece that showed the month
 * before the switch existed would make the switch look like it did nothing.
 */

// ── 6 · the totals ───────────────────────────────────────────────────────────

export function KpiPart() {
  const { ref, still } = usePart<HTMLDivElement>(KPI_SCRIPT);

  return (
    <div ref={ref}>
      <Panel className="overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-[var(--scr-hair)] lg:grid-cols-[minmax(0,1.55fr)_repeat(4,minmax(0,1fr))]">
          <motion.div
            className="col-span-2 bg-[var(--scr-panel)] px-4 py-3.5 lg:col-span-1"
            initial={still ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EXPO }}
          >
            <p className="text-[10px] tracking-wider text-[var(--scr-faint)] uppercase">
              Postes en la red
            </p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <p className="text-[30px] leading-none font-bold text-[var(--scr-text)]">
                <Counter to={NETWORK.total} still={still} duration={1.5} />
              </p>
              <svg viewBox="0 0 96 30" className="h-[30px] w-[96px] shrink-0">
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
            <p className="mt-2 text-[10px] text-[var(--scr-faint)]">
              {NETWORK.cities} ciudades · {NETWORK.tramos} tramos
            </p>
          </motion.div>

          {TOTALS.fortnight.map((kpi, i) => {
            const rising = kpi.delta > 0;
            const healthy = kpi.up === rising;
            const tone = healthy ? "var(--scr-ok)" : "var(--scr-warn)";
            return (
              <motion.div
                key={kpi.label}
                className="bg-[var(--scr-panel)] px-3.5 py-3.5"
                initial={still ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EXPO, delay: still ? 0 : 0.08 * (i + 1) }}
              >
                <p className="text-[10px] tracking-wider text-[var(--scr-faint)] uppercase">
                  {kpi.label}
                </p>
                <p className="mt-1.5 text-[24px] leading-none font-bold text-[var(--scr-text)]">
                  <Counter to={kpi.value} still={still} duration={1.2} />
                </p>
                <p className="mt-2 flex items-center gap-1 text-[10px]" style={{ color: tone }}>
                  {rising ? (
                    <ArrowUpIcon className="h-2.5 w-2.5" />
                  ) : (
                    <ArrowDownIcon className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(kpi.delta).toFixed(1).replace(".", ",")}%
                </p>
              </motion.div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

// ── 7 · activity over time ───────────────────────────────────────────────────

const CHART_W = 800;
const CHART_H = 150;
const HINT = 6;

export function ChartPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(CHART_SCRIPT);
  const hinted = step >= 1;

  const { created, solved, labels } = SERIES.fortnight;
  const n = created.length;
  const max = Math.max(...created) * 1.15;
  const slot = CHART_W / n;
  const barW = Math.min(20, slot * 0.5);
  const y = (v: number) => CHART_H - (v / max) * CHART_H;

  const line = solved
    .map((v, i) => `${i === 0 ? "M" : "L"} ${slot * i + slot / 2} ${y(v)}`)
    .join(" ");
  const area = `${line} L ${slot * (n - 1) + slot / 2} ${CHART_H} L ${slot / 2} ${CHART_H} Z`;

  const hintValue = created[HINT] ?? 0;
  const hintSolved = solved[HINT] ?? 0;
  const hintLeft = ((slot * HINT + slot / 2) / CHART_W) * 100;

  return (
    <div ref={ref}>
      <Panel className="px-4 pt-3 pb-2.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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

        <div className="relative">
          <motion.div
            initial={still ? false : { clipPath: "inset(0 100% 0 0)" }}
            animate={{ clipPath: "inset(0 0% 0 0)" }}
            transition={{ duration: 1.15, ease: [0.33, 1, 0.68, 1] }}
          >
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              preserveAspectRatio="none"
              className="h-[150px] w-full"
            >
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
                  fill={i === HINT && hinted ? "oklch(0.72 0.115 258)" : "oklch(0.545 0.095 258)"}
                />
              ))}

              <path d={area} fill="url(#solvedFill)" />
              <path
                d={line}
                fill="none"
                stroke="oklch(0.745 0.135 162)"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>

          <motion.div
            className="pointer-events-none absolute z-20 ml-3 w-[124px] rounded-lg border border-[var(--scr-line)] bg-[var(--scr-raise)] px-2.5 py-2 shadow-[0_16px_36px_-16px_oklch(0_0_0/0.9)]"
            style={{ left: `${hintLeft}%`, top: (y(hintValue) / CHART_H) * 150 - 60 }}
            initial={false}
            animate={hinted ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.28, ease: EXPO }}
          >
            <p className="text-[9.5px] text-[var(--scr-faint)]">13 ago 2026</p>
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

        <div className="mt-2 flex justify-between px-1 text-[9.5px] text-[var(--scr-faint)]">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      </Panel>
    </div>
  );
}

// ── 8 · changing the period ──────────────────────────────────────────────────

const PERIODS = ["15 días", "Este mes", "3 meses", "Este año", "Todo"];

export function PeriodPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(PERIOD_SCRIPT);
  const beat = beatOf(PERIOD_SCRIPT, step);
  const pos = useTargetBox(ref, beat.target, step);

  const dropdown = step === 2;
  const month = step >= 3;
  const totals = month ? TOTALS.month : TOTALS.fortnight;

  return (
    <div ref={ref} className="relative">
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <p className="text-[12px] font-semibold text-[var(--scr-text)]">Periodo</p>
          <div className="relative">
            <div
              data-target="period-trigger"
              className={`flex h-[26px] items-center gap-1.5 rounded-lg border px-2.5 text-[11px] transition-colors duration-200 ${
                dropdown
                  ? "border-[var(--scr-primary)] text-[var(--scr-text)]"
                  : "border-[var(--scr-hair)] text-[var(--scr-dim)]"
              }`}
            >
              <CalendarDaysIcon className="h-3 w-3" />
              {month ? "Este mes" : "15 días"}
              <ChevronDownIcon className="h-3 w-3 opacity-60" />
            </div>
            <motion.div
              className="absolute top-[30px] right-0 z-30 w-[112px] overflow-hidden rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)]"
              initial={false}
              animate={
                dropdown
                  ? { opacity: 1, y: 0, pointerEvents: "auto" }
                  : { opacity: 0, y: -6, pointerEvents: "none" }
              }
              transition={{ duration: 0.22, ease: EXPO }}
            >
              {PERIODS.map((p) => (
                <div
                  key={p}
                  data-target={p === "Este mes" ? "period-month" : undefined}
                  className={`flex h-[24px] items-center px-2.5 text-[10.5px] ${
                    p === "15 días" ? "text-[var(--scr-text)]" : "text-[var(--scr-dim)]"
                  }`}
                >
                  {p}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-[var(--scr-hair)] bg-[var(--scr-hair)]">
          {[totals[0], totals[2]].map((kpi) => (
            <div key={kpi.label} className="bg-[var(--scr-panel)] px-4 py-3">
              <p className="text-[10px] tracking-wider text-[var(--scr-faint)] uppercase">
                {kpi.label}
              </p>
              <p className="mt-1 text-[22px] leading-none font-bold text-[var(--scr-text)]">
                <Counter to={kpi.value} still={still} duration={0.9} />
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Cursor
        x={pos.x}
        y={pos.y}
        press={pressCount(PERIOD_SCRIPT, step)}
        hidden={still || step === 0}
      />
    </div>
  );
}

// ── 9 · what is still open ───────────────────────────────────────────────────

export function CriticalsPart() {
  const { ref, still } = usePart<HTMLDivElement>(CRITICALS_SCRIPT);
  const shown = CRITICALS.slice(0, 5);

  return (
    <div ref={ref}>
      <Panel className="px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-[var(--scr-text)]">Críticos sin resolver</p>
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-semibold"
            style={{
              color: CATASTROFICO.color,
              background: `color-mix(in oklch, ${CATASTROFICO.color} 14%, transparent)`,
            }}
          >
            {NETWORK.crit} abiertos
          </span>
        </div>

        <div className="mt-2">
          {shown.map((c, i) => (
            <motion.div
              key={c.pole}
              className="flex items-center gap-2.5 border-b border-[var(--scr-hair)] py-[7px] text-[10.5px] last:border-b-0"
              initial={still ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: EXPO, delay: still ? 0 : 0.09 * i }}
            >
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: CATASTROFICO.color }}
              />
              <span className="w-[46px] shrink-0 font-medium text-[var(--scr-text)]">{c.pole}</span>
              <span className="hidden w-[150px] shrink-0 truncate text-[var(--scr-dim)] sm:block">{c.obs.label}</span>
              <span className="flex-1 truncate text-[var(--scr-faint)]">{c.tramo}</span>
              <span className="ml-auto shrink-0 text-[var(--scr-faint)]">{c.days} días</span>
            </motion.div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
