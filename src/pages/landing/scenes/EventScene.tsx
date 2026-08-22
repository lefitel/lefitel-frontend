import { useRef } from "react";
import { motion } from "motion/react";
import { CheckIcon, ImageIcon, LoaderCircleIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { Cursor, ScreenHead, Toast, Typewriter } from "../chrome";
import { EXPO } from "../tokens";
import { useTargetBox } from "../stage-targets";
import { EVENT_SCRIPT, beatOf, pressCount } from "../scripts";

/**
 * Scene two: a technician files what they found.
 *
 * This is the only scene that shows work being created rather than read, which
 * is why it is the longest: a poster can claim "trazabilidad completa" in three
 * words, but watching a defect turn into a record with a photo, a severity and
 * a timestamp is the part a client actually buys.
 */



const OPTIONS = ["P-0118", "P-0227", "P-0384", "P-0472", "P-0473", "P-0611"];
const FILTERED = ["P-0472", "P-0473"];

const DESC = "Ferretería suelta en cruceta superior, riesgo de caída sobre la vía.";

const CHIPS = [
  { label: "Ferretería suelta", color: "oklch(0.755 0.155 62)" },
  { label: "Vano bajo", color: "oklch(0.78 0.16 118)" },
  { label: "Fricción", color: "oklch(0.745 0.135 162)" },
];

const ROWS = [
  { id: "EV-2291", poste: "P-0384", obs: "Sujeto a árbol", crit: "oklch(0.80 0.15 85)", estado: "Revisado", fecha: "19 ago" },
  { id: "EV-2290", poste: "P-0227", obs: "Estresado", crit: "oklch(0.72 0.11 195)", estado: "Solucionado", fecha: "19 ago" },
  { id: "EV-2289", poste: "P-0611", obs: "Catastrófico", crit: "oklch(0.655 0.205 25)", estado: "Pendiente", fecha: "18 ago" },
  { id: "EV-2288", poste: "P-0118", obs: "Antivibradores", crit: "oklch(0.72 0.10 225)", estado: "Solucionado", fecha: "18 ago" },
  { id: "EV-2287", poste: "P-0473", obs: "Vano bajo", crit: "oklch(0.78 0.16 118)", estado: "Revisado", fecha: "17 ago" },
  { id: "EV-2286", poste: "P-0295", obs: "Mantenimiento", crit: "oklch(0.66 0.11 258)", estado: "Solucionado", fecha: "17 ago" },
  { id: "EV-2285", poste: "P-0154", obs: "Ferretería suelta", crit: "oklch(0.755 0.155 62)", estado: "Pendiente", fecha: "16 ago" },
  { id: "EV-2284", poste: "P-0733", obs: "Fricción", crit: "oklch(0.745 0.135 162)", estado: "Solucionado", fecha: "16 ago" },
  { id: "EV-2283", poste: "P-0402", obs: "Daño estructural", crit: "oklch(0.80 0.15 85)", estado: "Revisado", fecha: "15 ago" },
  { id: "EV-2282", poste: "P-0918", obs: "Sujeto a árbol", crit: "oklch(0.80 0.15 85)", estado: "Solucionado", fecha: "14 ago" },
  { id: "EV-2281", poste: "P-0067", obs: "Estresado", crit: "oklch(0.72 0.11 195)", estado: "Solucionado", fecha: "14 ago" },
];

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

export function EventScene({ step, still }: { step: number; still: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const beat = beatOf(EVENT_SCRIPT, step);
  const pos = useTargetBox(root, beat.target, step);

  const open = step >= 2 && step < 4;
  const narrowed = step >= 3;
  const chosen = step >= 4;
  const priority = step >= 6;
  const typing = step >= 7;
  const uploading = step >= 8;
  const tagged = step >= 10;
  const saving = step === 12;
  const saved = step >= 13;

  return (
    <div ref={root} className="relative h-full w-full">
      <ScreenHead
        title="Eventos"
        sub="Incidencias registradas en campo y su estado de resolución"
        right={
          <div className="mt-0.5 flex h-[26px] items-center gap-1.5 rounded-lg bg-[var(--scr-primary)] px-2.5 text-[11px] font-medium text-white">
            <PlusIcon className="h-3 w-3" />
            Nuevo evento
          </div>
        }
      />

      {/* the register behind the sheet */}
      <div className="absolute inset-x-6 top-[76px] bottom-6 overflow-hidden rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)]">
        <div className="grid grid-cols-[74px_66px_1fr_96px_54px] gap-3 border-b border-[var(--scr-hair)] px-4 py-2.5 text-[9.5px] font-semibold tracking-wider text-[var(--scr-faint)] uppercase">
          <span>Evento</span>
          <span>Poste</span>
          <span>Observación</span>
          <span>Estado</span>
          <span>Fecha</span>
        </div>

        {saved && (
          <motion.div
            className="grid grid-cols-[74px_66px_1fr_96px_54px] items-center gap-3 border-b border-[var(--scr-hair)] px-4 text-[11px]"
            initial={{ height: 0, opacity: 0, backgroundColor: "oklch(0.745 0.135 162 / 0.18)" }}
            animate={{ height: 34, opacity: 1, backgroundColor: "oklch(0.745 0.135 162 / 0)" }}
            transition={{ height: { duration: 0.4, ease: EXPO }, backgroundColor: { duration: 1.6, delay: 0.5 } }}
          >
            <span className="font-medium text-[var(--scr-text)]">EV-2292</span>
            <span className="text-[var(--scr-dim)]">P-0472</span>
            <span className="flex items-center gap-1.5 text-[var(--scr-dim)]">
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: CHIPS[0].color }} />
              Ferretería suelta
            </span>
            <span className="text-[var(--scr-warn)]">Pendiente</span>
            <span className="text-[var(--scr-faint)]">21 ago</span>
          </motion.div>
        )}

        {ROWS.map((row) => (
          <div
            key={row.id}
            className="grid h-[34px] grid-cols-[74px_66px_1fr_96px_54px] items-center gap-3 border-b border-[var(--scr-hair)] px-4 text-[11px]"
          >
            <span className="font-medium text-[var(--scr-text)]">{row.id}</span>
            <span className="text-[var(--scr-dim)]">{row.poste}</span>
            <span className="flex items-center gap-1.5 text-[var(--scr-dim)]">
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: row.crit }} />
              {row.obs}
            </span>
            <span className="text-[var(--scr-faint)]">{row.estado}</span>
            <span className="text-[var(--scr-faint)]">{row.fecha}</span>
          </div>
        ))}
      </div>

      {/* dimmer */}
      <motion.div
        className="absolute inset-0 bg-[oklch(0.12_0.01_258)]"
        initial={false}
        animate={{ opacity: saved ? 0 : 0.55 }}
        transition={{ duration: 0.4, ease: EXPO }}
      />

      {/* the sheet */}
      <motion.div
        className="absolute top-0 right-0 flex h-full w-[356px] flex-col border-l border-[var(--scr-line)] bg-[var(--scr-panel)] shadow-[-24px_0_60px_-24px_oklch(0_0_0/0.8)]"
        initial={still ? false : { x: 372 }}
        animate={{ x: saved ? 372 : 0 }}
        transition={{ duration: saved ? 0.36 : 0.52, ease: EXPO }}
      >
        <div className="flex items-center justify-between border-b border-[var(--scr-hair)] px-4 py-3">
          <div>
            <p className="text-[13.5px] leading-none font-bold text-[var(--scr-text)]">Nuevo Evento</p>
            <p className="mt-1.5 text-[10px] text-[var(--scr-faint)]">Registro de incidencia en campo</p>
          </div>
          <XIcon className="h-3.5 w-3.5 text-[var(--scr-faint)]" />
        </div>

        <div className="flex-1 space-y-3 px-4 py-3.5">
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
                  <span className="text-[11.5px] font-medium text-[var(--scr-text)]">P-0472</span>
                ) : open ? (
                  <Typewriter
                    text="P-04"
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
                animate={open ? { opacity: 1, y: 0, pointerEvents: "auto" } : { opacity: 0, y: -6, pointerEvents: "none" }}
                transition={{ duration: 0.22, ease: EXPO }}
              >
                {(narrowed ? FILTERED : OPTIONS).map((option) => (
                  <div
                    key={option}
                    data-target={option === "P-0472" ? "ev-option" : undefined}
                    className={`flex h-[26px] items-center px-2.5 text-[11px] ${
                      option === "P-0472" && narrowed
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
              ["Propietario", "Operadora regional"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-[var(--scr-hair)] bg-[var(--scr-bg)] px-2.5 py-1.5">
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
              animate={{ backgroundColor: priority ? "oklch(0.755 0.155 62)" : "oklch(0.305 0.014 258)" }}
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
                <Typewriter text={DESC} active={typing} still={still} cps={31} className="text-[var(--scr-text)]" />
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
                {uploading ? <PoleThumb /> : <ImageIcon className="h-3.5 w-3.5 text-[var(--scr-faint)]" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10.5px] text-[var(--scr-dim)]">
                  {uploading ? "P0472-cruceta.jpg" : "Arrastra una fotografía o pulsa para elegir"}
                </p>
                <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-[var(--scr-raise)]">
                  <motion.div
                    className="h-full origin-left rounded-full bg-[var(--scr-ok)]"
                    initial={false}
                    animate={{ scaleX: uploading ? 1 : 0 }}
                    transition={{ duration: still ? 0 : 1.1, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              {uploading && (
                <motion.span
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--scr-ok)]"
                  initial={still ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: still ? 0 : 1.15, duration: 0.3, ease: EXPO }}
                >
                  <CheckIcon className="h-2.5 w-2.5" style={{ color: "oklch(0.16 0.02 162)" }} strokeWidth={3.5} />
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
                      background: on ? `color-mix(in oklch, ${chip.color} 16%, transparent)` : "transparent",
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
            className="flex min-w-[86px] items-center justify-center gap-1.5 rounded-md bg-[var(--scr-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
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
      </motion.div>

      <Toast show={saved} title="Evento registrado" detail="EV-2292 · P-0472 · prioritario" />

      <Cursor x={pos.x} y={pos.y} press={pressCount(EVENT_SCRIPT, step)} hidden={still || step === 0 || saved} />
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
