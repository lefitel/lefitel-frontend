import { Link } from "react-router-dom";
import { motion, useInView } from "motion/react";
import { useRef } from "react";
import { ArrowDownIcon, ArrowRightIcon, ArrowUpRightIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../components/theme-provider";
import { ScrollShowcase } from "./landing/ScrollShowcase";
import { TramoPlan } from "./landing/TramoPlan";
import { Reveal } from "./landing/chrome";
import { EXPO, paperClass, paperVars } from "./landing/tokens";
import { usePrefersReducedMotion } from "./landing/useTimeline";
import logo from "../assets/images/logo.png";
import tigoLogo from "../assets/images/logo_tigo.png";
import vivaLogo from "../assets/images/logo_viva.png";
import entelLogo from "../assets/images/logo_entel.png";

/**
 * The public page, drawn as a survey sheet.
 *
 * Paper and graphite with the logo's orange, because the work is field survey
 * and the most characteristic thing in that world is the line plan of a tramo
 * with a fault marked on it. That plan is the hero. The product showcase sits
 * in a dark band halfway down: those are screens, and the change of ground
 * says so.
 *
 * Who the page is for decides the buttons. A client already has the login; the
 * page exists for the operator who does not know Osefi yet, so the primary
 * action everywhere is to get in touch, and the client access is a quiet link
 * in the corner.
 *
 * Figures are rounded on purpose ("más de 1.500"). Exact counts went stale
 * between deploys and ended up contradicting the showcase two screens below.
 */

const CONTACT = {
  email: "osefibolivia@gmail.com",
  phone: "+591 76846009",
  phoneHref: "tel:+59176846009",
  whatsapp: "https://wa.me/59176846009",
  address: "Calle José Peña Castellón Nº 1065",
};

const FACTS = [
  { value: "+1.500", label: "postes" },
  { value: "+85", label: "ciudades" },
  { value: "3", label: "operadoras" },
];

/** What a client gets from each service; the last column is the deliverable. */
const SERVICES = [
  {
    title: "Inspección en campo",
    text: "Cuadrillas propias recorren la red y revisan cada poste: estructura, cruceta, ferretería, vanos y cable.",
    delivers: "Ficha por poste, con foto y coordenadas",
  },
  {
    title: "Registro de incidencias",
    text: "Cada desperfecto se registra al pie del poste, con su observación y su gravedad en una escala de nueve niveles.",
    delivers: "Evento con criticidad del 1 al 9",
  },
  {
    title: "Seguimiento hasta el cierre",
    text: "La incidencia sigue abierta hasta que se resuelve, y guarda quién la abrió, quién la cerró y qué se hizo.",
    delivers: "Historial completo por evento",
  },
  {
    title: "Informes para la operadora",
    text: "Paneles con el estado de la red y un generador de informes que la operadora arma a su medida.",
    delivers: "Excel en su formato, también por correo programado",
  },
];

/** A real sequence, so it is numbered. */
const STEPS = [
  {
    title: "Inspección",
    text: "Recorridos sistemáticos de la infraestructura para registrar el estado real de la red en campo.",
  },
  {
    title: "Registro",
    text: "Cada hallazgo entra en el sistema con coordenadas, fotografía y clasificación técnica.",
  },
  {
    title: "Reporte",
    text: "La operadora recibe informes limpios, listos para priorizar el mantenimiento.",
  },
];

const BENEFITS = [
  "Menos tiempo entre que algo se rompe y alguien lo sabe.",
  "Cada intervención trazada: quién, cuándo y dónde.",
  "Datos georreferenciados, consultables en cualquier momento.",
  "Informes con el formato que ya usa tu equipo.",
];

/** Small mono label above a heading. */
function Eyebrow({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <p
      className={`flex items-center gap-2.5 font-[family-name:var(--pp-mono)] text-[12px] tracking-[0.12em] uppercase ${
        onDark ? "text-white/55" : "text-[var(--pp-dim)]"
      }`}
    >
      <span aria-hidden="true" className="h-2 w-2 bg-[var(--pp-mark)]" />
      {children}
    </p>
  );
}

/** Jumps to a section, smoothly unless the reader asked for less motion. */
function useJump() {
  const still = usePrefersReducedMotion();
  return (id: string) => (e: React.MouseEvent) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  };
}

/**
 * The process line. The cable between the three steps draws across once when
 * it scrolls into view, then the steps arrive in order along it. Only transform
 * moves, never width.
 */
function Process() {
  const ref = useRef<HTMLOListElement>(null);
  const onScreen = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const still = usePrefersReducedMotion();
  const shown = onScreen || still;

  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-3 md:gap-8">
      <motion.span
        aria-hidden="true"
        className="absolute top-[11px] right-0 left-0 hidden h-px origin-left bg-[var(--pp-ink)] md:block"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: shown ? 1 : 0 }}
        transition={still ? { duration: 0 } : { duration: 1.1, ease: EXPO }}
      />
      {STEPS.map((step, i) => (
        <motion.li
          key={step.title}
          className="relative"
          initial={{ opacity: 0, y: 14 }}
          animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={still ? { duration: 0 } : { duration: 0.6, ease: EXPO, delay: 0.25 + i * 0.22 }}
        >
          <span className="relative z-10 grid h-6 w-6 place-items-center bg-[var(--pp-ink)] font-[family-name:var(--pp-mono)] text-[11px] font-medium text-[var(--pp-paper)]">
            {i + 1}
          </span>
          <h3 className="mt-5 text-xl font-extrabold [font-stretch:110%]">{step.title}</h3>
          <p className="mt-2 max-w-[34ch] leading-relaxed text-[var(--pp-dim)]">{step.text}</p>
        </motion.li>
      ))}
    </ol>
  );
}

function ContactRow({
  label,
  value,
  href,
  external = false,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="col-span-2 font-[family-name:var(--pp-mono)] text-[12px] tracking-[0.12em] text-[var(--pp-dim)] uppercase sm:col-span-1">
        {label}
      </span>
      <span className="min-w-0 text-lg font-bold break-words [font-stretch:105%] sm:text-xl">{value}</span>
      {href && (
        <ArrowUpRightIcon
          aria-hidden="true"
          className="h-5 w-5 text-[var(--pp-acc)] transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        />
      )}
    </>
  );
  const row =
    "group grid grid-cols-[minmax(0,1fr)_1.25rem] items-center gap-x-4 gap-y-1 border-t border-[var(--pp-rule)] py-5 sm:grid-cols-[6.5rem_minmax(0,1fr)_1.25rem]";

  if (!href) return <div className={row}>{body}</div>;
  return (
    <a
      href={href}
      className={`${row} transition-colors duration-200 hover:bg-[var(--pp-sunk)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-acc)]`}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {body}
    </a>
  );
}

const LandingPage = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const still = usePrefersReducedMotion();
  const jump = useJump();
  const enter = (delay: number) =>
    ({
      initial: { opacity: 0, y: 16 },
      animate: { opacity: 1, y: 0 },
      transition: still ? { duration: 0 } : { duration: 0.8, ease: EXPO, delay },
    }) as const;

  const focusRing =
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pp-acc)]";

  return (
    <div
      style={paperVars}
      className={`${paperClass} min-h-screen overflow-x-hidden bg-[var(--pp-paper)] font-[family-name:var(--pp-sans)] text-[var(--pp-ink)] selection:bg-[var(--pp-acc)]/25`}
    >
      {/* ── NAV ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-[var(--pp-rule)] bg-[var(--pp-paper)]">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <a href="#inicio" onClick={jump("inicio")} className={`flex items-center gap-2.5 ${focusRing}`}>
            <img src={logo} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-extrabold tracking-[0.06em] [font-stretch:112%]">OSEFI</span>
          </a>
          <div className="flex items-center gap-3 text-sm sm:gap-6">
            {[
              ["servicios", "Servicios"],
              ["plataforma", "Plataforma"],
              ["contacto", "Contacto"],
            ].map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                onClick={jump(id)}
                className={`hidden text-[var(--pp-dim)] transition-colors hover:text-[var(--pp-ink)] md:inline ${focusRing}`}
              >
                {label}
              </a>
            ))}
            {/* The same switch as the login's, on the same stored preference:
                whichever theme is picked here is the one the login and the
                system open in. */}
            <button
              type="button"
              onClick={() => setTheme(dark ? "light" : "dark")}
              aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
              className={`grid h-8 w-8 place-items-center rounded-md text-[var(--pp-dim)] transition-colors hover:bg-[var(--pp-sunk)] hover:text-[var(--pp-ink)] ${focusRing}`}
            >
              {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
            </button>
            <Link
              to="/login"
              className={`rounded-md border border-[var(--pp-ink)] px-3.5 py-1.5 font-semibold transition-colors duration-200 hover:bg-[var(--pp-ink)] hover:text-[var(--pp-paper)] ${focusRing}`}
            >
              Acceso clientes
            </Link>
          </div>
        </nav>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        id="inicio"
        className="scroll-mt-16 bg-[linear-gradient(var(--pp-grid)_1px,transparent_1px),linear-gradient(90deg,var(--pp-grid)_1px,transparent_1px)] bg-[size:32px_32px] bg-[position:-1px_-1px]"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pt-12 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20 lg:pb-24">
          <div>
            <motion.div {...enter(0)}>
              <Eyebrow>Servicios de campo · Telecomunicaciones · Bolivia</Eyebrow>
            </motion.div>
            <motion.h1
              {...enter(0.08)}
              className="mt-5 text-[2.6rem] leading-[0.98] font-[850] tracking-[-0.02em] text-balance [font-stretch:118%] sm:text-6xl lg:text-[4.1rem]"
            >
              Sabemos cómo está <span className="text-[var(--pp-acc)]">cada poste</span> de tu red.
            </motion.h1>
            <motion.p
              {...enter(0.16)}
              className="mt-6 max-w-[46ch] text-lg leading-relaxed text-[var(--pp-dim)]"
            >
              Inspeccionamos, documentamos y reportamos la infraestructura de las operadoras de
              telecomunicaciones. Cada hallazgo llega con su fotografía, su ubicación y su gravedad.
            </motion.p>
            <motion.div {...enter(0.26)} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a
                href="#contacto"
                onClick={jump("contacto")}
                className={`group inline-flex items-center gap-2 rounded-md bg-[var(--pp-fill)] px-6 py-3.5 font-bold text-[var(--pp-on-fill)] transition-[background-color,transform] duration-200 ease-out hover:bg-[var(--pp-fill-hover)] active:scale-[0.97] ${focusRing}`}
              >
                Hablemos
                <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
              </a>
              <a
                href="#proceso"
                onClick={jump("proceso")}
                className={`inline-flex items-center gap-1.5 text-sm font-semibold underline-offset-4 hover:underline ${focusRing}`}
              >
                Ver cómo trabajamos
                <ArrowDownIcon className="h-3.5 w-3.5" />
              </a>
            </motion.div>
            <motion.ul
              {...enter(0.36)}
              className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-[var(--pp-ink)] pt-3 font-[family-name:var(--pp-mono)] text-[13px] text-[var(--pp-dim)]"
            >
              {FACTS.map((f) => (
                <li key={f.label}>
                  <span className="font-medium text-[var(--pp-ink)] tabular-nums">{f.value}</span> {f.label}
                </li>
              ))}
            </motion.ul>
          </div>
          <TramoPlan />
        </div>
      </section>

      {/* ── OPERATORS ────────────────────────────────────────────── */}
      <section className="border-y border-[var(--pp-rule)] bg-[var(--pp-sunk)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-12 gap-y-5 px-5 py-7 sm:px-8">
          <p className="font-[family-name:var(--pp-mono)] text-[12px] tracking-[0.12em] text-[var(--pp-dim)] uppercase">
            Trabajamos para
          </p>
          <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
            {[
              [tigoLogo, "Tigo"],
              [vivaLogo, "Viva"],
              [entelLogo, "Entel"],
            ].map(([src, name]) => (
              <img key={name} src={src} alt={name} className="h-7 object-contain opacity-75 brightness-0 dark:invert" />
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────── */}
      <section id="servicios" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 sm:px-8 sm:py-28">
        <Reveal className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow>Servicios</Eyebrow>
            <h2 className="mt-4 text-3xl leading-[1.05] font-extrabold tracking-[-0.015em] text-balance [font-stretch:112%] sm:text-[2.6rem]">
              Del poste al informe, de nuestra mano.
            </h2>
          </div>
          <p className="max-w-[52ch] self-end leading-relaxed text-[var(--pp-dim)] lg:col-span-6 lg:col-start-7">
            Nos ocupamos de todo el recorrido: salimos a campo, registramos lo que encontramos, lo
            seguimos hasta que se resuelve y te lo entregamos en el formato que ya usas.
          </p>
        </Reveal>

        <div className="mt-14 border-b border-[var(--pp-ink)]">
          <div
            aria-hidden="true"
            className="hidden grid-cols-12 gap-8 border-b border-[var(--pp-ink)] pb-2 font-[family-name:var(--pp-mono)] text-[11px] tracking-[0.12em] text-[var(--pp-dim)] uppercase md:grid"
          >
            <span className="col-span-4">Servicio</span>
            <span className="col-span-5">Qué hacemos</span>
            <span className="col-span-3">Qué recibes</span>
          </div>
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.06}>
              <div className="grid gap-2 border-t border-[var(--pp-rule)] py-6 transition-colors duration-300 first:border-t-0 hover:bg-[var(--pp-sunk)] md:grid-cols-12 md:gap-8 md:px-3 md:-mx-3">
                <h3 className="text-lg font-bold [font-stretch:108%] md:col-span-4">{s.title}</h3>
                <p className="leading-relaxed text-[var(--pp-dim)] md:col-span-5">{s.text}</p>
                <p className="mt-1 flex gap-2 font-[family-name:var(--pp-mono)] text-[13px] md:col-span-3 md:mt-0">
                  <span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-[var(--pp-mark)]" />
                  {s.delivers}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PROCESS ──────────────────────────────────────────────── */}
      <section id="proceso" className="scroll-mt-16 border-t border-[var(--pp-rule)]">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
          <Reveal className="mb-14 max-w-2xl">
            <Eyebrow>Cómo trabajamos</Eyebrow>
            <h2 className="mt-4 text-3xl leading-[1.05] font-extrabold tracking-[-0.015em] text-balance [font-stretch:112%] sm:text-[2.6rem]">
              De campo a reporte, sin perder detalle.
            </h2>
          </Reveal>
          <Process />
        </div>
      </section>

      {/* ── SHOWCASE ─────────────────────────────────────────────── */}
      <div id="plataforma" className="scroll-mt-16">
        <ScrollShowcase />
      </div>

      {/* ── CONTACT ──────────────────────────────────────────────── */}
      <section id="contacto" className="mx-auto max-w-6xl scroll-mt-16 px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <Reveal className="lg:col-span-5">
            <Eyebrow>Contacto</Eyebrow>
            <h2 className="mt-4 text-4xl leading-[1] font-[850] tracking-[-0.02em] text-balance [font-stretch:118%] sm:text-5xl">
              ¿Gestionas una red en Bolivia? <span className="text-[var(--pp-acc)]">Hablemos.</span>
            </h2>
            <ul className="mt-9 space-y-3">
              {BENEFITS.map((b) => (
                <li key={b} className="flex gap-3 leading-relaxed text-[var(--pp-dim)]">
                  <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 bg-[var(--pp-mark)]" />
                  {b}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.12} className="lg:col-span-6 lg:col-start-7 lg:pt-10">
            <div className="border-b border-[var(--pp-rule)]">
              <ContactRow label="Correo" value={CONTACT.email} href={`mailto:${CONTACT.email}`} />
              <ContactRow label="WhatsApp" value={CONTACT.phone} href={CONTACT.whatsapp} external />
              <ContactRow label="Teléfono" value={CONTACT.phone} href={CONTACT.phoneHref} />
              <ContactRow label="Oficina" value={CONTACT.address} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--pp-ink)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <img src={logo} alt="" className="h-7 w-7 object-contain" />
            <div>
              <p className="font-extrabold tracking-[0.06em] [font-stretch:112%]">OSEFI SRL</p>
              <p className="text-[var(--pp-dim)]">Precisión en campo. Continuidad en red.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-[family-name:var(--pp-mono)] text-[12px] text-[var(--pp-dim)]">
            <span>© {new Date().getFullYear()} Osefi SRL</span>
            <Link
              to="/login"
              className={`inline-flex items-center gap-1 text-[var(--pp-ink)] underline-offset-4 hover:underline ${focusRing}`}
            >
              Acceso clientes
              <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
