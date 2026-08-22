import { useRef } from "react";
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
import { Counter, Cursor, ScreenHead } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../stage-targets";
import { REPORT_SCRIPT, beatOf, pressCount } from "../scripts";

/**
 * Scene four: a report nobody had to ask a developer for.
 *
 * Columns are chosen, a condition is written, the answer appears, and it leaves
 * as a spreadsheet. The filter is deliberately the one the dashboard was
 * worrying about two scenes earlier — criticality "Catastrófico" — so the twelve
 * rows that come back are the same twelve the map counted. One system, one set
 * of numbers, which is the entire argument.
 */



/** Which step adds which column, and where it lands. */
const PICKS: Record<number, { from: string; slot: number }> = {
  2: { from: "gen-f-nombre", slot: 0 },
  4: { from: "gen-f-tramo", slot: 1 },
  6: { from: "gen-f-fecha", slot: 2 },
  8: { from: "gen-f-criticidad", slot: 3 },
};

const COLUMNS = [
  { label: "Poste › Nombre", addedAt: 2 },
  { label: "Poste › Tramo", addedAt: 4 },
  { label: "Evento › Fecha", addedAt: 6 },
  { label: "Evento › Criticidad", addedAt: 8 },
];

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

const RESULTS = [
  ["P-0611", "Tramo Sur", "18 ago 2026"],
  ["P-0289", "Tramo Sur", "17 ago 2026"],
  ["P-0154", "Tramo Centro", "16 ago 2026"],
  ["P-0733", "Tramo Este", "15 ago 2026"],
  ["P-0402", "Tramo Norte", "15 ago 2026"],
  ["P-0918", "Tramo Este", "13 ago 2026"],
  ["P-0067", "Tramo Centro", "12 ago 2026"],
  ["P-0525", "Tramo Sur", "11 ago 2026"],
  ["P-0881", "Tramo Norte", "10 ago 2026"],
  ["P-0243", "Tramo Centro", "9 ago 2026"],
];

const CRIT = "oklch(0.655 0.205 25)";

export function ReportScene({ step, still }: { step: number; still: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const beat = beatOf(REPORT_SCRIPT, step);
  const pos = useTargetBox(root, beat.target, step);

  const pick = PICKS[step];
  const from = useTargetBox(root, pick?.from, step);
  const to = useTargetBox(root, pick ? `gen-slot-${pick.slot}` : null, step);

  const columns = COLUMNS.filter((c) => step >= c.addedAt);
  const filtered = step >= 10;
  const results = step >= 11;
  const menu = step === 13;
  const exporting = step >= 14;
  const delivered = step >= 15;

  return (
    <div ref={root} className="relative h-full w-full">
      <ScreenHead
        title="Generador de reportes"
        sub="Consulta a medida sobre eventos, postes y ciudades"
        right={
          <div className="relative mt-0.5 flex items-center gap-2">
            <div className="flex h-[26px] items-center rounded-lg border border-[var(--scr-hair)] px-2.5 text-[11px] text-[var(--scr-faint)]">
              Guardar plantilla
            </div>
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
              animate={menu ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: 0, y: -6, pointerEvents: "none" }}
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
        }
      />

      <div className="absolute inset-x-6 top-[76px] bottom-6 flex gap-3">
        {/* field catalogue */}
        <motion.div
          className="flex w-[232px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)]"
          initial={still ? false : { opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EXPO }}
        >
          <div className="flex h-[30px] items-center gap-2 border-b border-[var(--scr-hair)] px-3">
            <SearchIcon className="h-3 w-3 text-[var(--scr-faint)]" />
            <span className="text-[11px] text-[var(--scr-faint)]">Buscar campo…</span>
          </div>

          <div className="flex-1 overflow-hidden px-2 py-2">
            {CATALOG.map((group) => (
              <div key={group.group} className="mb-1">
                <p className="px-1.5 py-1 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
                  {group.group}
                </p>
                {group.fields.map((field) => {
                  const added = COLUMNS.some(
                    (c) => step >= c.addedAt && c.label.endsWith(`› ${field.label}`) && c.label.startsWith(group.group),
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
        </motion.div>

        {/* configuration and result */}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-3 py-2">
            <p className="mb-1.5 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
              Columnas del reporte
            </p>
            <div className="flex min-h-[26px] flex-wrap items-center gap-1.5">
              {columns.length === 0 && (
                <span className="text-[11px] text-[var(--scr-faint)]">Elige campos en el catálogo de la izquierda</span>
              )}
              {columns.map((column, i) => (
                <motion.div
                  key={column.label}
                  data-target={`gen-slot-${i}`}
                  className="flex items-center gap-1.5 rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] py-1 pr-1.5 pl-2 text-[10.5px] text-[var(--scr-text)]"
                  initial={still ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: still ? 0 : 0.42 }}
                >
                  {column.label}
                  <XIcon className="h-2.5 w-2.5 text-[var(--scr-faint)]" />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] px-3 py-2">
            <p className="mb-1.5 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">Filtros</p>
            <div className="flex items-center gap-2">
              <motion.div
                className="flex items-center gap-1.5 overflow-hidden"
                initial={false}
                animate={{ width: filtered ? "auto" : 0, opacity: filtered ? 1 : 0 }}
                transition={{ duration: 0.38, ease: EXPO }}
              >
                <span className="rounded-md border border-[var(--scr-line)] bg-[var(--scr-bg)] px-2 py-1 text-[10.5px] whitespace-nowrap text-[var(--scr-text)]">
                  Evento › Criticidad
                </span>
                <span className="text-[10.5px] whitespace-nowrap text-[var(--scr-faint)]">es igual a</span>
                <span
                  className="rounded-md border px-2 py-1 text-[10.5px] font-medium whitespace-nowrap"
                  style={{ borderColor: `${CRIT}`, color: CRIT, background: "oklch(0.655 0.205 25 / 0.12)" }}
                >
                  Catastrófico
                </span>
              </motion.div>
              <div
                data-target="gen-addfilter"
                className="flex items-center gap-1.5 rounded-md border border-dashed border-[var(--scr-line)] px-2 py-1 text-[10.5px] whitespace-nowrap text-[var(--scr-faint)]"
              >
                <PlusIcon className="h-3 w-3" />
                Añadir filtro
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1.1fr] gap-2 border-b border-[var(--scr-hair)] px-3 py-2 text-[9px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
              <span>Nombre</span>
              <span>Tramo</span>
              <span>Fecha</span>
              <span>Criticidad</span>
            </div>

            <div className="relative min-h-0 flex-1">
              {!results && (
                <div className="flex h-full items-center justify-center text-[11px] text-[var(--scr-faint)]">
                  {filtered ? "Ejecutando consulta…" : "La vista previa aparece al elegir columnas"}
                </div>
              )}
              {results &&
                RESULTS.map((row, i) => (
                  <motion.div
                    key={row[0]}
                    className="grid h-[21px] grid-cols-[1fr_1fr_1fr_1.1fr] items-center gap-2 px-3 text-[10.5px]"
                    initial={still ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.32, ease: EXPO, delay: still ? 0 : i * 0.055 }}
                  >
                    <span className="font-medium text-[var(--scr-text)]">{row[0]}</span>
                    <span className="text-[var(--scr-dim)]">{row[1]}</span>
                    <span className="text-[var(--scr-faint)] tabular-nums">{row[2]}</span>
                    <span className="flex items-center gap-1.5" style={{ color: CRIT }}>
                      <span className="h-[6px] w-[6px] rounded-full" style={{ background: CRIT }} />
                      Catastrófico
                    </span>
                  </motion.div>
                ))}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--scr-hair)] px-3 py-1.5 text-[10px] text-[var(--scr-faint)]">
              <span>
                {results ? (
                  <>
                    <Counter to={10} still={still} duration={0.7} /> filas · {columns.length} columnas
                  </>
                ) : (
                  <>{columns.length} columnas elegidas</>
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
          </div>
        </div>
      </div>

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
            {COLUMNS[pick.slot].label}
          </div>
        </motion.div>
      )}

      <Cursor x={pos.x} y={pos.y} press={pressCount(REPORT_SCRIPT, step)} hidden={still || step === 0} />
    </div>
  );
}
