import { motion } from "motion/react";
import { CheckIcon, ImageIcon, LoaderCircleIcon, SearchIcon, XIcon } from "lucide-react";
import { Cursor, Panel, Toast, Typewriter } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../targets";
import { FORM_SCRIPT, SAVED_SCRIPT, beatOf, pressCount } from "../scripts";
import { usePart } from "../usePart";
import { EVENT, OBS, POLE, REGISTER } from "./fiction";

/**
 * The two pieces that come from filing an event: the form a technician fills in
 * the street, and what the register looks like a second later.
 *
 * This is the only pair that shows work being created rather than read. A
 * poster can claim "trazabilidad completa" in three words; watching a defect
 * turn into a record with a photo, a severity and a timestamp is the part a
 * client actually buys.
 */

const OPTIONS = ["P118", "P227", "P384", POLE.id, "P473", "P611"];
const FILTERED = [POLE.id, "P473"];

const CHIPS = [OBS.ferreteria, OBS.vano, OBS.friccion];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10.5px] font-medium text-[var(--scr-dim)]">
        {label} <span className="text-[var(--scr-crit)]">*</span>
      </p>
      {children}
    </div>
  );
}

// ── 4 · the report from the field ────────────────────────────────────────────

export function FormPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(FORM_SCRIPT);
  const beat = beatOf(FORM_SCRIPT, step);
  const pos = useTargetBox(ref, beat.target, step);

  const open = step >= 2 && step < 4;
  const narrowed = step >= 3;
  const chosen = step >= 4;
  const priority = step >= 6;
  const typing = step >= 7;
  const uploading = step >= 8;
  const tagged = step >= 10;
  const saving = step >= 11;

  return (
    <div ref={ref} className="relative max-w-[380px]">
      <Panel className="overflow-visible">
        <div className="flex items-center justify-between border-b border-[var(--scr-hair)] px-4 py-3">
          <div>
            <p className="text-[13.5px] leading-none font-bold text-[var(--scr-text)]">
              Nuevo Evento
            </p>
            <p className="mt-1.5 text-[10px] text-[var(--scr-faint)]">
              Registro de incidencia en campo
            </p>
          </div>
          <XIcon className="h-3.5 w-3.5 text-[var(--scr-faint)]" />
        </div>

        <div className="space-y-3 px-4 py-3.5">
          <Field label="Poste">
            <div className="relative">
              <div
                data-target="ev-poste"
                className={`flex h-[30px] items-center gap-2 rounded-md border bg-[var(--scr-bg)] px-2.5 transition-colors duration-200 ${
                  open ? "border-[var(--scr-primary)]" : "border-[var(--scr-line)]"
                }`}
              >
                <SearchIcon className="h-3 w-3 shrink-0 text-[var(--scr-faint)]" />
                {chosen ? (
                  <span className="text-[11.5px] font-medium text-[var(--scr-text)]">
                    {POLE.id}
                  </span>
                ) : open ? (
                  <Typewriter
                    text="P47"
                    active={open}
                    still={still}
                    cps={11}
                    className="text-[11.5px] text-[var(--scr-text)]"
                  />
                ) : (
                  <span className="text-[11.5px] text-[var(--scr-faint)]">Buscar poste…</span>
                )}
              </div>

              <motion.div
                className="absolute top-[34px] right-0 left-0 z-30 overflow-hidden rounded-md border border-[var(--scr-line)] bg-[var(--scr-raise)] shadow-[0_18px_40px_-18px_oklch(0_0_0/0.9)]"
                initial={false}
                animate={
                  open
                    ? { opacity: 1, y: 0, pointerEvents: "auto" }
                    : { opacity: 0, y: -6, pointerEvents: "none" }
                }
                transition={{ duration: 0.22, ease: EXPO }}
              >
                {(narrowed ? FILTERED : OPTIONS).map((option) => (
                  <div
                    key={option}
                    data-target={option === POLE.id ? "ev-option" : undefined}
                    className={`flex h-[26px] items-center px-2.5 text-[11px] ${
                      option === POLE.id && narrowed
                        ? "bg-[var(--scr-primary)]/25 text-[var(--scr-text)]"
                        : "text-[var(--scr-dim)]"
                    }`}
                  >
                    {option}
                  </div>
                ))}
              </motion.div>
            </div>
          </Field>

          <motion.div
            className="grid grid-cols-2 gap-2 overflow-hidden"
            initial={false}
            animate={{ height: chosen ? 44 : 0, opacity: chosen ? 1 : 0 }}
            transition={{ duration: 0.36, ease: EXPO }}
          >
            {[
              ["Tramo", "Norte · Km 12,4"],
              ["Propietario", POLE.owner],
            ].map(([k, v]) => (
              <div
                key={k}
                className="rounded-md border border-[var(--scr-hair)] bg-[var(--scr-bg)] px-2.5 py-1.5"
              >
                <p className="text-[9px] text-[var(--scr-faint)]">{k}</p>
                <p className="mt-0.5 truncate text-[10.5px] text-[var(--scr-dim)]">{v}</p>
              </div>
            ))}
          </motion.div>

          <div
            data-target="ev-switch"
            className="flex items-center justify-between rounded-md border border-[var(--scr-hair)] bg-[var(--scr-bg)] px-2.5 py-2"
          >
            <span className="text-[11px] text-[var(--scr-dim)]">Evento prioritario</span>
            <motion.div
              className="flex h-[16px] w-[28px] items-center rounded-full px-[2px]"
              animate={{
                backgroundColor: priority ? "oklch(0.755 0.155 62)" : "oklch(0.305 0.014 258)",
              }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                className="block h-[12px] w-[12px] rounded-full bg-white"
                animate={{ x: priority ? 12 : 0 }}
                transition={{ duration: 0.28, ease: EXPO }}
              />
            </motion.div>
          </div>

          <Field label="Descripción">
            <div
              data-target="ev-desc"
              className={`h-[52px] rounded-md border bg-[var(--scr-bg)] px-2.5 py-2 text-[11px] leading-relaxed transition-colors duration-200 ${
                typing ? "border-[var(--scr-primary)]" : "border-[var(--scr-line)]"
              }`}
            >
              {typing ? (
                <Typewriter
                  text={EVENT.description}
                  active={typing}
                  still={still}
                  cps={33}
                  className="text-[var(--scr-text)]"
                />
              ) : (
                <span className="text-[var(--scr-faint)]">Describe el problema encontrado…</span>
              )}
            </div>
          </Field>

          <Field label="Imagen">
            <div
              data-target="ev-image"
              className="flex h-[54px] items-center gap-2.5 rounded-md border border-dashed border-[var(--scr-line)] bg-[var(--scr-bg)] px-2.5"
            >
              <div className="grid h-[38px] w-[46px] shrink-0 place-items-center overflow-hidden rounded bg-[var(--scr-raise)]">
                {uploading ? (
                  <PoleThumb />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5 text-[var(--scr-faint)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] text-[var(--scr-dim)]">
                  {uploading ? EVENT.photo : "Arrastra una fotografía o pulsa para elegir"}
                </p>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--scr-raise)]">
                  <motion.div
                    className="h-full origin-left rounded-full bg-[var(--scr-ok)]"
                    initial={false}
                    animate={{ scaleX: uploading ? 1 : 0 }}
                    transition={{ duration: still ? 0 : 1.05, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              {uploading && (
                <motion.span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--scr-ok)]"
                  initial={still ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: still ? 0 : 1.1, duration: 0.3, ease: EXPO }}
                >
                  <CheckIcon
                    className="h-2.5 w-2.5"
                    style={{ color: "oklch(0.16 0.02 162)" }}
                    strokeWidth={3.5}
                  />
                </motion.span>
              )}
            </div>
          </Field>

          <div>
            <p className="mb-1.5 text-[10.5px] font-medium text-[var(--scr-dim)]">Observación</p>
            <div className="flex flex-wrap gap-1.5">
              {CHIPS.map((chip, i) => {
                const on = tagged && i === 0;
                return (
                  <div
                    key={chip.label}
                    data-target={i === 0 ? "ev-chip" : undefined}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors duration-300"
                    style={{
                      borderColor: on ? chip.color : "var(--scr-line)",
                      background: on
                        ? `color-mix(in oklch, ${chip.color} 16%, transparent)`
                        : "transparent",
                      color: on ? chip.color : "var(--scr-faint)",
                    }}
                  >
                    {on && <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />}
                    {chip.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--scr-hair)] px-4 py-3">
          <div className="rounded-md border border-[var(--scr-line)] px-3 py-1.5 text-[11px] text-[var(--scr-faint)]">
            Cancelar
          </div>
          <div
            data-target="ev-save"
            className="flex min-w-[96px] items-center justify-center gap-1.5 rounded-md bg-[var(--scr-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
          >
            {saving ? (
              <>
                <LoaderCircleIcon className="h-3 w-3 animate-spin" />
                Guardando
              </>
            ) : (
              "Guardar evento"
            )}
          </div>
        </div>
      </Panel>

      <Cursor x={pos.x} y={pos.y} press={pressCount(FORM_SCRIPT, step)} hidden={still || step === 0} />
    </div>
  );
}

/** Stand-in for the field photograph: a pole, drawn, so nothing real is published. */
function PoleThumb() {
  return (
    <svg viewBox="0 0 46 38" className="h-full w-full">
      <rect width="46" height="38" fill="oklch(0.30 0.02 240)" />
      <path d="M0 30 H46" stroke="oklch(0.38 0.03 140)" strokeWidth="8" />
      <rect x="21" y="6" width="3.4" height="26" fill="oklch(0.55 0.015 258)" />
      <rect x="13" y="10" width="20" height="2.4" fill="oklch(0.60 0.015 258)" />
      <rect x="15" y="16" width="16" height="2.2" fill="oklch(0.58 0.015 258)" />
      <circle cx="31" cy="11" r="2" fill="oklch(0.755 0.155 62)" />
    </svg>
  );
}

// ── 5 · the notice, and the row that was not there before ────────────────────

const COLS = "grid-cols-[30px_64px_1fr] sm:grid-cols-[34px_72px_1fr_104px_62px]";

export function SavedPart() {
  const { ref, step, still } = usePart<HTMLDivElement>(SAVED_SCRIPT);
  const saved = step >= 1;
  const notice = step === 1;

  return (
    <div ref={ref} className="relative">
      <Panel className="relative overflow-hidden">
        <div className="pointer-events-none absolute top-2.5 right-2.5 z-30">
          <Toast
            show={notice}
            title="Evento registrado"
            detail={`${POLE.id} · ${EVENT.obs.label}`}
          />
        </div>

        <div
          className={`grid ${COLS} gap-3 border-b border-[var(--scr-hair)] px-4 py-2.5 text-[9.5px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase`}
        >
          <span>#</span>
          <span>Poste</span>
          <span>Observación</span>
          <span className="hidden sm:block">Estado</span>
          <span className="hidden sm:block">Fecha</span>
        </div>

        <motion.div
          className={`grid ${COLS} items-center gap-3 overflow-hidden border-b border-[var(--scr-hair)] px-4 text-[11px]`}
          initial={
            still
              ? false
              : { height: 0, opacity: 0, backgroundColor: "oklch(0.745 0.135 162 / 0.2)" }
          }
          animate={
            saved
              ? {
                  height: 36,
                  opacity: 1,
                  // Without motion the flash never happens, so the tint stays:
                  // it is the only thing marking which row is the new one.
                  backgroundColor: still
                    ? "oklch(0.745 0.135 162 / 0.13)"
                    : "oklch(0.745 0.135 162 / 0)",
                }
              : { height: 0, opacity: 0 }
          }
          transition={{
            height: { duration: 0.42, ease: EXPO },
            backgroundColor: { duration: 1.8, delay: 0.6 },
          }}
        >
          <span className="text-[var(--scr-faint)]">{EVENT.row}</span>
          <span className="text-[var(--scr-dim)]">{POLE.id}</span>
          <span className="flex items-center gap-1.5 truncate text-[var(--scr-dim)]">
            <span
              className="h-[6px] w-[6px] shrink-0 rounded-full"
              style={{ background: EVENT.obs.color }}
            />
            {EVENT.obs.label}
          </span>
          <span className="hidden text-[var(--scr-warn)] sm:block">Pendiente</span>
          <span className="hidden text-[var(--scr-faint)] sm:block">{EVENT.date}</span>
        </motion.div>

        {REGISTER.map((row) => (
          <div
            key={row.row}
            className={`grid h-[36px] ${COLS} items-center gap-3 border-b border-[var(--scr-hair)] px-4 text-[11px] last:border-b-0`}
          >
            <span className="text-[var(--scr-faint)]">{row.row}</span>
            <span className="text-[var(--scr-dim)]">{row.pole}</span>
            <span className="flex items-center gap-1.5 truncate text-[var(--scr-dim)]">
              <span
                className="h-[6px] w-[6px] shrink-0 rounded-full"
                style={{ background: row.obs.color }}
              />
              {row.obs.label}
            </span>
            <span className="hidden text-[var(--scr-faint)] sm:block">{row.state}</span>
            <span className="hidden text-[var(--scr-faint)] sm:block">{row.date}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
