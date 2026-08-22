import { useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { AppFrame, Stage, type RailId } from "./chrome";
import { EXPO } from "./tokens";
import { DASH_SCRIPT, EVENT_SCRIPT, MAP_SCRIPT, REPORT_SCRIPT, type Script } from "./scripts";
import { usePrefersReducedMotion, useTimeline } from "./useTimeline";
import { MapScene } from "./scenes/MapScene";
import { EventScene } from "./scenes/EventScene";
import { DashboardScene } from "./scenes/DashboardScene";
import { ReportScene } from "./scenes/ReportScene";

/**
 * The public page's one look inside the product.
 *
 * Four screens of the system, each running a short scripted demonstration, in a
 * window that advances on its own. It sits high on the page, straight after the
 * counters, because a visitor who scrolls past four paragraphs of services
 * without ever seeing the tool has been told what we do and shown nothing.
 *
 * Everything shown is invented. The tool is real, the poles in it are not.
 */

interface Tab {
  id: string;
  label: string;
  route: string;
  rail: RailId;
  script: Script;
  caption: string;
  Scene: (props: { step: number; still: boolean }) => React.JSX.Element;
}

const TABS: Tab[] = [
  {
    id: "mapa",
    label: "Mapa",
    route: "osefi.bo/app/ciudades/santa-cruz",
    rail: "ciudades",
    script: MAP_SCRIPT,
    caption:
      "Cada poste inspeccionado queda situado en el plano. Un clic abre su ficha, y el filtro deja a la vista solo lo que aún necesita cuadrilla.",
    Scene: MapScene,
  },
  {
    id: "eventos",
    label: "Eventos",
    route: "osefi.bo/app/eventos",
    rail: "eventos",
    script: EVENT_SCRIPT,
    caption:
      "Lo que el técnico encuentra en la calle entra al sistema con fotografía, gravedad y fecha. A partir de ahí ya no se pierde ni depende de que alguien se acuerde.",
    Scene: EventScene,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    route: "osefi.bo/app/home",
    rail: "home",
    script: DASH_SCRIPT,
    caption:
      "Las cifras salen de esos mismos partes, no de una hoja aparte. Se cambia el periodo y el cuadro entero se rehace: totales, tendencia y actividad.",
    Scene: DashboardScene,
  },
  {
    id: "reportes",
    label: "Reportes",
    route: "osefi.bo/app/generador",
    rail: "generador",
    script: REPORT_SCRIPT,
    caption:
      "El informe se arma eligiendo campos y condiciones, sin pedírselo a nadie. Sale en Excel o PDF con el formato que cada operadora necesita.",
    Scene: ReportScene,
  },
];

/** Beat table for the clock. Identity is irrelevant: the hook keys off the tab. */
const beatsOf = (script: Script) => script.steps.map((s) => s.at);

export function SystemShowcase() {
  const section = useRef<HTMLDivElement>(null);
  const onScreen = useInView(section, { margin: "-15% 0px -15% 0px" });
  const still = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  /** Once a tab is chosen by hand the sequence stops driving itself. */
  const [manual, setManual] = useState(false);

  const tab = TABS[index];
  const playing = onScreen && !hovering;

  const step = useTimeline({
    beats: beatsOf(tab.script),
    duration: tab.script.duration,
    playing,
    resetKey: tab.id,
    still,
    stillStep: tab.script.stillStep,
    onEnd: manual ? undefined : () => setIndex((i) => (i + 1) % TABS.length),
  });

  const choose = (i: number) => {
    setManual(true);
    setIndex(i);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = e.key === "ArrowRight" ? (index + 1) % TABS.length : (index - 1 + TABS.length) % TABS.length;
    choose(next);
  };

  return (
    <section ref={section} className="relative border-t border-white/6 px-6 py-28">
      <div className="mx-auto max-w-[1000px]">
        <div className="max-w-2xl">
          <p className="mb-5 text-xs font-semibold tracking-[0.25em] text-orange-400 uppercase">La plataforma</p>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Esto es lo que verás
            <br />
            <span className="text-white/30">cada mañana al entrar.</span>
          </h2>
          <p className="mt-6 text-[0.95rem] leading-relaxed text-white/45">
            Cuatro pantallas del sistema haciendo el recorrido que hace un usuario. Pasa el cursor por encima para
            detener la secuencia, o elige la pantalla que quieras ver.
          </p>
        </div>

        {/* measure rule: a quiet nod to the trade, and a break between text and screen */}
        <div
          aria-hidden="true"
          className="mt-14 h-3 w-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, oklch(1 0 0 / 0.13) 0 1px, transparent 1px 14px)",
            maskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
          }}
        />

        {/* tabs */}
        <div
          role="tablist"
          aria-label="Pantallas del sistema"
          className="mt-5 flex items-end overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t, i) => {
            const on = i === index;
            return (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls="showcase-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => choose(i)}
                onKeyDown={onKeyDown}
                className={`relative shrink-0 cursor-pointer rounded-t-md px-3 py-2.5 text-sm font-medium sm:px-4 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-orange-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080f] focus-visible:outline-none ${
                  on ? "text-white" : "text-white/35 hover:text-white/70"
                }`}
              >
                {t.label}
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/8" />
                {on && (
                  <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                    {still || manual ? (
                      <span className="block h-full w-full bg-orange-400" />
                    ) : (
                      <span
                        key={`${t.id}-${playing}`}
                        className="block h-full w-full origin-left bg-orange-400"
                        style={{
                          animation: `showcase-fill ${t.script.duration}ms linear forwards`,
                          animationPlayState: playing ? "running" : "paused",
                        }}
                      />
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* the screen */}
        <div
          id="showcase-panel"
          role="tabpanel"
          aria-label={tab.label}
          className="-mx-6 mt-4 sm:mx-0"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <Stage>
            <AppFrame route={tab.route} active={tab.rail}>
              <motion.div
                key={tab.id}
                className="h-full w-full"
                initial={still ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, ease: EXPO }}
              >
                <tab.Scene step={step} still={still} />
              </motion.div>
            </AppFrame>
          </Stage>
        </div>

        <motion.p
          key={tab.id}
          className="mt-6 max-w-2xl text-sm leading-relaxed text-white/40"
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EXPO }}
        >
          <span className="font-medium text-white/70">{tab.label}. </span>
          {tab.caption}
        </motion.p>
      </div>
    </section>
  );
}
