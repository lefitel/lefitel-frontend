import { motion } from "motion/react";
import {
  CheckIcon,
  ChevronDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  SigmaIcon,
  XIcon,
} from "lucide-react";
import { Counter, Cursor, Panel } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../targets";
import { COLUMNS_SCRIPT, EXPORT_SCRIPT, beatOf, pressCount } from "../scripts";
import { usePart } from "../usePart";
import { CRITICALS, NETWORK, OBS } from "./fiction";

/**
 * The two pieces that come from the report generator.
 *
 * The condition they build is the one the dashboard was worrying about a moment
 * earlier — criticality "Catastrófico" — so the rows that come back are the
 * same ten the plan counted and the same ten the criticals list said were open.
 * One system, one set of numbers, which is the whole argument the section is
 * making.
 */

// ── 10 · choosing the columns ────────────────────────────────────────────────

const COLUMNS = [
  { label: "Poste › Nombre", addedAt: 2 },
  { label: "Poste › Tramo", addedAt: 4 },
  { label: "Evento › Fecha", addedAt: 6 },
  { label: "Evento › Criticidad", addedAt: 8 },
];

/** Which step adds which column, and where it lands. */
const PICKS: Record<number, { from: string; slot: number }> = {
  2: { from: "gen-f-nombre", slot: 0 },
  4: { from: "gen-f-tramo", slot: 1 },
  6: { from: "gen-f-fecha", slot: 2 },
  8: { from: "gen-f-criticidad", slot: 3 },
};

const CATALOG = [
  {
    group: "Evento",
    fields: [
      { label: "Código", target: undefined },
      { label: "Fecha", target: "gen-f-fecha" },
      { label: "Criticidad", target: "gen-f-criticidad" },
      { label: "Prioritario", target: undefined },
    ],
  },
  {
    group: "Poste",
    fields: [
      { label: "Nombre", target: "gen-f-nombre" },
      { label: "Tramo", target: "gen-f-tramo" },
      { label: "Material", target: undefined },
      { label: "Altura", target: undefined },
    ],
  },
  {
    group: "Ciudad",
    fields: [
      { label: "Nombre", target: undefined },
      { label: "Departamento", target: undefined },
    ],
  },
];

export function ColumnsPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(COLUMNS_SCRIPT);
  const beat = beatOf(COLUMNS_SCRIPT, step);
  const pos = useTargetBox(ref, beat.target, step);

  const pick = PICKS[step];
  const from = useTargetBox(ref, pick?.from, step);
  const to = useTargetBox(ref, pick ? `gen-slot-${pick.slot}` : undefined, step);

  const chosen = COLUMNS.filter((c) => step >= c.addedAt);

  return (
    <div ref={ref} className="relative grid items-start gap-3 sm:grid-cols-[232px_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <div className="flex h-[30px] items-center gap-2 border-b border-[var(--scr-hair)] px-3">
          <SearchIcon className="h-3 w-3 text-[var(--scr-faint)]" />
          <span className="text-[11px] text-[var(--scr-faint)]">Buscar campo…</span>
        </div>

        <div
          className="max-h-[214px] overflow-hidden px-2 py-2"
          style={{
            maskImage: "linear-gradient(to bottom, black 84%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black 84%, transparent)",
          }}
        >
          {CATALOG.map((group) => (
            <div key={group.group} className="mb-1">
              <p className="px-1.5 py-1 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
                {group.group}
              </p>
              {group.fields.map((field) => {
                const added = COLUMNS.some(
                  (c) =>
                    step >= c.addedAt &&
                    c.label === `${group.group} › ${field.label}`,
                );
                return (
                  <div
                    key={field.label}
                    data-target={field.target}
                    className="flex h-[22px] items-center gap-2 rounded px-1.5 text-[11px] transition-colors duration-300"
                    style={{
                      background: added ? "oklch(0.635 0.105 258 / 0.16)" : "transparent",
                      color: added ? "var(--scr-text)" : "var(--scr-dim)",
                    }}
                  >
                    {added ? (
                      <CheckIcon className="h-3 w-3 text-[var(--scr-primary)]" strokeWidth={3} />
                    ) : (
                      <PlusIcon className="h-3 w-3 opacity-35" />
                    )}
                    {field.label}
                  </div>
                );
              })}
            </div>
          ))}
          <div className="mt-1 flex h-[22px] items-center gap-2 rounded px-1.5 text-[11px] text-[var(--scr-faint)]">
            <SigmaIcon className="h-3 w-3 opacity-50" />
            Revisiones · total
          </div>
        </div>
      </Panel>

      <Panel className="px-3 py-3">
        <p className="mb-2 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
          Columnas del reporte
        </p>
        <div className="flex min-h-[26px] flex-wrap items-start gap-1.5">
          {chosen.length === 0 && (
            <span className="text-[11px] text-[var(--scr-faint)]">
              Elige campos en el catálogo
            </span>
          )}
          {chosen.map((column, i) => (
            <motion.div
              key={column.label}
              data-target={`gen-slot-${i}`}
              className="flex items-center gap-1.5 rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] py-1 pr-1.5 pl-2 text-[10.5px] whitespace-nowrap text-[var(--scr-text)]"
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: still ? 0 : 0.42 }}
            >
              {column.label}
              <XIcon className="h-2.5 w-2.5 text-[var(--scr-faint)]" />
            </motion.div>
          ))}
        </div>
      </Panel>

      {/* the column, in flight */}
      {pick && !still && from.w > 0 && to.w > 0 && (
        <motion.div
          key={`fly-${step}`}
          className="pointer-events-none absolute top-0 left-0 z-40"
          initial={{ x: from.x, y: from.y, opacity: 0.95 }}
          animate={{ x: to.x, y: to.y, opacity: [0.95, 1, 0] }}
          transition={{
            duration: 0.46,
            ease: EXPO,
            opacity: { times: [0, 0.72, 1], duration: 0.46 },
          }}
        >
          <div className="-translate-x-1/2 -translate-y-1/2 rounded-md border border-[var(--scr-primary)] bg-[var(--scr-raise)] px-2 py-1 text-[10.5px] whitespace-nowrap text-[var(--scr-text)] shadow-[0_10px_24px_-10px_oklch(0_0_0/0.9)]">
            {COLUMNS[pick.slot]?.label}
          </div>
        </motion.div>
      )}

      <Cursor
        x={pos.x}
        y={pos.y}
        press={pressCount(COLUMNS_SCRIPT, step)}
        hidden={still || step === 0}
      />
    </div>
  );
}

// ── 11 · the condition, the answer, the file ─────────────────────────────────

const ROW = "grid-cols-[0.85fr_1fr_1.3fr] sm:grid-cols-[1fr_1fr_1fr_1.15fr]";

export function ExportPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(EXPORT_SCRIPT);
  const beat = beatOf(EXPORT_SCRIPT, step);
  const pos = useTargetBox(ref, beat.target, step);

  const filtered = step >= 2;
  const results = step >= 3;
  const menu = step === 5;
  const exporting = step >= 6;
  const delivered = step >= 7;

  return (
    <div ref={ref} className="relative">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--scr-hair)] px-3 py-2.5">
          <motion.div
            className="flex items-center gap-1.5 overflow-hidden"
            initial={false}
            animate={{ width: filtered ? "auto" : 0, opacity: filtered ? 1 : 0 }}
            transition={{ duration: 0.38, ease: EXPO }}
          >
            <span className="rounded-md border border-[var(--scr-line)] bg-[var(--scr-bg)] px-2 py-1 text-[10.5px] whitespace-nowrap text-[var(--scr-text)]">
              Evento › Criticidad
            </span>
            <span className="text-[10.5px] whitespace-nowrap text-[var(--scr-faint)]">
              es igual a
            </span>
            <span
              className="rounded-md border px-2 py-1 text-[10.5px] font-medium whitespace-nowrap"
              style={{
                borderColor: OBS.catastrofico.color,
                color: OBS.catastrofico.color,
                background: `color-mix(in oklch, ${OBS.catastrofico.color} 12%, transparent)`,
              }}
            >
              {OBS.catastrofico.label}
            </span>
          </motion.div>

          <div
            data-target="gen-addfilter"
            className="flex items-center gap-1.5 rounded-md border border-dashed border-[var(--scr-line)] px-2 py-1 text-[10.5px] whitespace-nowrap text-[var(--scr-faint)]"
          >
            <PlusIcon className="h-3 w-3" />
            Añadir filtro
          </div>

          <div className="relative ml-auto">
            <div
              data-target="gen-export"
              className="flex h-[26px] items-center gap-1.5 rounded-lg bg-[var(--scr-primary)] px-2.5 text-[11px] font-medium text-white"
            >
              Exportar
              <ChevronDownIcon className="h-3 w-3 opacity-70" />
            </div>
            <motion.div
              className="absolute top-[30px] right-0 z-40 w-[136px] overflow-hidden rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)]"
              initial={false}
              animate={
                menu
                  ? { opacity: 1, y: 0, pointerEvents: "auto" }
                  : { opacity: 0, y: -6, pointerEvents: "none" }
              }
              transition={{ duration: 0.22, ease: EXPO }}
            >
              <div
                data-target="gen-excel"
                className="flex h-[26px] items-center gap-2 px-2.5 text-[10.5px] text-[var(--scr-text)]"
              >
                <FileSpreadsheetIcon className="h-3 w-3 text-[var(--scr-ok)]" />
                Excel (.xlsx)
              </div>
              <div className="flex h-[26px] items-center gap-2 px-2.5 text-[10.5px] text-[var(--scr-dim)]">
                <FileTextIcon className="h-3 w-3" />
                PDF
              </div>
            </motion.div>
          </div>
        </div>

        <div
          className={`grid ${ROW} gap-2 border-b border-[var(--scr-hair)] px-3 py-2 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase`}
        >
          <span>Nombre</span>
          <span className="hidden sm:block">Tramo</span>
          <span>Fecha</span>
          <span>Criticidad</span>
        </div>

        <div className="relative min-h-[220px]">
          {!results && (
            <div className="flex h-[220px] items-center justify-center text-[11px] text-[var(--scr-faint)]">
              {filtered ? "Ejecutando consulta…" : "Añade una condición para acotar el resultado"}
            </div>
          )}
          {results &&
            CRITICALS.map((row, i) => (
              <motion.div
                key={row.id}
                className={`grid h-[22px] ${ROW} items-center gap-2 px-3 text-[10.5px]`}
                initial={still ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.32, ease: EXPO, delay: still ? 0 : i * 0.055 }}
              >
                <span className="font-medium text-[var(--scr-text)]">{row.pole}</span>
                <span className="hidden text-[var(--scr-dim)] sm:block">{row.tramo}</span>
                <span className="text-[var(--scr-faint)] tabular-nums">{row.date}</span>
                <span
                  className="flex items-center gap-1.5 truncate"
                  style={{ color: OBS.catastrofico.color }}
                >
                  <span
                    className="h-[6px] w-[6px] shrink-0 rounded-full"
                    style={{ background: OBS.catastrofico.color }}
                  />
                  {OBS.catastrofico.label}
                </span>
              </motion.div>
            ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--scr-hair)] px-3 py-2 text-[10px] text-[var(--scr-faint)]">
          <span>
            {results ? (
              <>
                <Counter to={NETWORK.crit} still={still} duration={0.7} /> filas · 4 columnas
              </>
            ) : (
              "4 columnas elegidas"
            )}
          </span>
          <motion.span
            className="flex items-center gap-1.5"
            initial={false}
            animate={{ opacity: exporting ? 1 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <FileSpreadsheetIcon className="h-3 w-3 text-[var(--scr-ok)]" />
            <span className="text-[var(--scr-dim)]">eventos-criticos.xlsx</span>
            <span className="block h-[3px] w-[54px] overflow-hidden rounded-full bg-[var(--scr-raise)]">
              <motion.span
                className="block h-full origin-left rounded-full bg-[var(--scr-ok)]"
                initial={false}
                animate={{ scaleX: exporting ? 1 : 0 }}
                transition={{ duration: still ? 0 : 0.85, ease: [0.4, 0, 0.2, 1] }}
              />
            </span>
            {delivered && <CheckIcon className="h-3 w-3 text-[var(--scr-ok)]" strokeWidth={3} />}
          </motion.span>
        </div>
      </Panel>

      <Cursor
        x={pos.x}
        y={pos.y}
        press={pressCount(EXPORT_SCRIPT, step)}
        hidden={still || step === 0}
      />
    </div>
  );
}
