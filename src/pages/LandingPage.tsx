import { Link } from "react-router-dom";
import {
  motion,
  useInView,
  useScroll,
  useTransform,
  useMotionValue,
  useMotionTemplate,
  animate,
} from "motion/react";
import { useRef, useEffect } from "react";
import {
  ArrowRightIcon,
  MapPinIcon,
  ClipboardListIcon,
  BellIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  PhoneIcon,
  MailIcon,
} from "lucide-react";
import logo from "../assets/images/logo.png";
import tigoLogo from "../assets/images/tigo.png";

const ease = [0.16, 1, 0.3, 1] as const;

const HERO_LINE1 = ["Precisión", "en", "campo."];
const HERO_LINE2 = ["Continuidad", "en", "red."];

function AnimatedNumber({ value, duration = 1.8 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        if (ref.current) ref.current.textContent = Math.round(v).toLocaleString("es-BO");
      },
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  return <span ref={ref}>0</span>;
}

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

const STATS = [
  { value: 1661, label: "Postes registrados", suffix: "+" },
  { value: 99,   label: "Ciudades cubiertas", suffix: "" },
  { value: 1487, label: "Eventos gestionados", suffix: "+" },
  { value: 17,   label: "Empresas clientes",   suffix: "" },
];

const SERVICES = [
  {
    icon: MapPinIcon,
    title: "Inspección en campo",
    description:
      "Técnicos especializados recorren la red verificando el estado físico de cada poste y sus componentes con evidencia georeferenciada.",
  },
  {
    icon: ClipboardListIcon,
    title: "Reporte técnico",
    description:
      "Reportes estructurados con fotografías, clasificación de daños y prioridades de intervención listos para la operadora.",
  },
  {
    icon: BellIcon,
    title: "Gestión de eventos",
    description:
      "Seguimiento de cada incidencia desde el registro hasta la resolución, con historial completo y trazabilidad garantizada.",
  },
  {
    icon: BarChart3Icon,
    title: "Análisis y monitoreo",
    description:
      "Paneles en tiempo real con estadísticas de estado de red, tiempos de resolución y cobertura geográfica por tramo.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Inspección",
    description:
      "Nuestros técnicos realizan recorridos sistemáticos de la infraestructura, registrando el estado real de la red en campo.",
  },
  {
    number: "02",
    title: "Registro",
    description:
      "Cada hallazgo queda documentado en el sistema con coordenadas GPS, fotografías y clasificación técnica precisa.",
  },
  {
    number: "03",
    title: "Reporte",
    description:
      "La operadora recibe reportes detallados, limpios y listos para decisiones de mantenimiento y priorización de intervenciones.",
  },
];

const BENEFITS = [
  "Reducción de tiempos de respuesta ante incidencias",
  "Trazabilidad completa de cada intervención en campo",
  "Datos georeferenciados y accesibles en tiempo real",
  "Reportes adaptados al estándar de cada operadora",
  "Personal técnico certificado con cobertura en Bolivia",
];

const LandingPage = () => {
  const mouseX = useMotionValue(-500);
  const mouseY = useMotionValue(-500);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(249,115,22,0.09), transparent 80%)`;

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 600], [0, -70]);
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0.15]);

  function onHeroMouseMove(e: React.MouseEvent<HTMLElement>) {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - left);
    mouseY.set(e.clientY - top);
  }

  function onHeroMouseLeave() {
    mouseX.set(-500);
    mouseY.set(-500);
  }

  return (
    <div className="min-h-screen bg-[#08080f] text-white overflow-x-hidden" style={{ fontFamily: "'Geist Variable', sans-serif" }}>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex flex-col"
        onMouseMove={onHeroMouseMove}
        onMouseLeave={onHeroMouseLeave}
      >
        {/* grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem]" />

        {/* animated blobs */}
        <motion.div
          className="absolute top-0 right-0 w-[700px] h-[700px] rounded-full blur-[140px] -translate-y-1/3 translate-x-1/3 pointer-events-none bg-orange-500/7"
          animate={{ scale: [1, 1.12, 1], opacity: [0.07, 0.12, 0.07] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 left-0 w-[450px] h-[450px] rounded-full blur-[120px] pointer-events-none bg-orange-600/4"
          animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.07, 0.04] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* mouse spotlight */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: spotlight }}
        />

        {/* nav */}
        <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Osefi SRL" className="h-8 w-8 object-contain" />
            <span className="font-bold text-sm tracking-wide">
              OSEFI<span className="text-orange-400"> SRL</span>
            </span>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm text-white/50 hover:text-white border border-white/8 hover:border-white/20 rounded-lg px-4 py-2 transition-all duration-200"
          >
            Acceder al sistema
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        </nav>

        {/* hero content — parallax on scroll */}
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 pb-16 pt-8"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 bg-orange-500/8 border border-orange-500/20 rounded-full px-4 py-1.5 text-orange-400 text-xs font-medium tracking-[0.18em] uppercase mb-10"
          >
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
            Telecomunicaciones · Infraestructuras · Bolivia
          </motion.div>

          {/* word-by-word headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.08] max-w-4xl">
            <span className="block">
              {HERO_LINE1.map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 44, filter: "blur(12px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.85, delay: 0.1 + i * 0.11, ease }}
                >
                  {word}{i < HERO_LINE1.length - 1 && " "}
                </motion.span>
              ))}
            </span>
            <span className="shimmer-orange block">
              {HERO_LINE2.map((word, i) => (
                <motion.span
                  key={i}
                  className="inline-block"
                  initial={{ opacity: 0, y: 44, filter: "blur(12px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.85, delay: 0.48 + i * 0.11, ease }}
                >
                  {word}{i < HERO_LINE2.length - 1 && " "}
                </motion.span>
              ))}
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.88, ease }}
            className="mt-7 text-white/45 text-lg sm:text-xl max-w-2xl leading-relaxed"
          >
            Somos la empresa terciarizada de field services que inspecciona, documenta
            y reporta el estado de tu red de infraestructura en Bolivia.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.05, ease }}
            className="mt-10"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2.5 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-9 py-4 rounded-xl transition-all duration-200 shadow-xl shadow-orange-500/20 group text-base"
            >
              Acceder al sistema
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>

        {/* scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="relative z-10 flex justify-center pb-10"
        >
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-6 h-10 border border-white/10 rounded-full flex items-start justify-center pt-2"
          >
            <div className="w-1 h-2 bg-orange-400/70 rounded-full" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────── */}
      <section className="border-y border-white/6 bg-white/1.5">
        <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08}>
              <div className="text-center">
                <div className="text-4xl sm:text-5xl font-extrabold text-orange-400 tabular-nums">
                  <AnimatedNumber value={stat.value} />
                  {stat.suffix}
                </div>
                <div className="mt-2.5 text-sm text-white/35 font-medium tracking-wide">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SERVICES ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <Reveal className="text-center mb-16">
          <p className="text-orange-400 text-xs font-semibold uppercase tracking-[0.25em] mb-5">Nuestros servicios</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Todo lo que tu red necesita,
            <br />
            <span className="text-white/30">gestionado por nosotros.</span>
          </h2>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SERVICES.map((service, i) => {
            const Icon = service.icon;
            return (
              <Reveal key={service.title} delay={i * 0.1}>
                <div className="group relative h-full bg-white/2.5 hover:bg-white/5 border border-white/6 hover:border-orange-500/30 rounded-2xl p-7 transition-all duration-500 cursor-default overflow-hidden">
                  {/* hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-[radial-gradient(ellipse_at_30%_0%,rgba(249,115,22,0.1),transparent_65%)]" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 bg-orange-500/8 rounded-xl flex items-center justify-center mb-6 group-hover:bg-orange-500/15 transition-colors duration-300">
                      <Icon className="h-5 w-5 text-orange-400" />
                    </div>
                    <h3 className="font-bold text-[0.9rem] text-white mb-3">{service.title}</h3>
                    <p className="text-white/38 text-sm leading-relaxed">{service.description}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── PROCESS ──────────────────────────────────────────────── */}
      <section className="relative bg-white/1.5 border-y border-white/6 py-28">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-20">
            <p className="text-orange-400 text-xs font-semibold uppercase tracking-[0.25em] mb-5">Proceso</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
              De campo a reporte,
              <br />
              <span className="text-white/30">sin perder detalle.</span>
            </h2>
          </Reveal>

          <div className="relative grid md:grid-cols-3 gap-10">
            <div className="hidden md:block absolute top-8 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-linear-to-r from-transparent via-orange-500/30 to-transparent" />

            {STEPS.map((step, i) => (
              <Reveal key={step.number} delay={i * 0.15}>
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full border border-orange-500/25 bg-orange-500/6 mb-7 relative z-10">
                    <span className="text-orange-400 font-extrabold text-lg tracking-tight">{step.number}</span>
                  </div>
                  <h3 className="font-bold text-white mb-3 text-lg">{step.title}</h3>
                  <p className="text-white/38 text-sm leading-relaxed">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR WHOM ─────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <Reveal>
            <p className="text-orange-400 text-xs font-semibold uppercase tracking-[0.25em] mb-5">Para quién</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-6">
              Diseñado para
              <br />
              <span className="text-white/30">operadoras de telecomunicaciones.</span>
            </h2>
            <p className="text-white/45 leading-relaxed mb-10 text-[0.95rem]">
              Si gestionas una red de telecomunicaciones en Bolivia y necesitas visibilidad
              real sobre el estado de tu infraestructura en campo, Osefi SRL es tu aliado operativo.
            </p>
            <ul className="space-y-4">
              {BENEFITS.map((b, i) => (
                <motion.li
                  key={b}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08, ease }}
                  className="flex items-start gap-3 text-sm text-white/55"
                >
                  <CheckCircle2Icon className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                  {b}
                </motion.li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="bg-white/2.5 border border-white/6 rounded-3xl p-8 space-y-7">
              <div>
                <p className="text-white/25 text-xs uppercase tracking-widest mb-5">Trabajamos con</p>
                <div className="flex items-center gap-4">
                  <img
                    src={tigoLogo}
                    alt="Tigo"
                    className="h-9 object-contain brightness-0 invert opacity-50 hover:opacity-80 transition-opacity"
                  />
                </div>
              </div>

              <div className="border-t border-white/6 pt-7">
                <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Cobertura nacional</p>
                <p className="text-white font-extrabold text-3xl tabular-nums">99</p>
                <p className="text-white/35 text-sm mt-1">ciudades en territorio boliviano</p>
              </div>

              <div className="border-t border-white/6 pt-7">
                <p className="text-white/25 text-xs uppercase tracking-widest mb-3">Plataforma propia</p>
                <p className="text-white/50 text-sm leading-relaxed">
                  Sistema interno de gestión con postes, eventos, reportes, bitácora
                  y mapas en tiempo real — todo integrado para el cliente.
                </p>
              </div>

              <div className="border-t border-white/6 pt-7">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-orange-500/8 hover:bg-orange-500/15 border border-orange-500/20 hover:border-orange-500/35 text-orange-400 text-sm font-medium px-5 py-2.5 rounded-lg transition-all duration-200 group"
                >
                  Ver el sistema
                  <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="border-t border-white/6 bg-white/1.5">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-start justify-between gap-12">
            <div className="space-y-5 max-w-xs">
              <div className="flex items-center gap-3">
                <img src={logo} alt="Osefi SRL" className="h-7 w-7 object-contain" />
                <span className="font-bold text-sm tracking-wide">
                  OSEFI<span className="text-orange-400"> SRL</span>
                </span>
              </div>
              <p className="text-white/28 text-sm leading-relaxed">
                Telecomunicaciones e Infraestructuras.
                <br />
                Precisión en campo. Continuidad en red.
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-white/25 text-xs uppercase tracking-widest">Contacto</p>
              <div className="flex items-center gap-2.5 text-sm text-white/45">
                <MailIcon className="h-4 w-4 text-orange-400 shrink-0" />
                contacto@osefi.com.bo
              </div>
              <div className="flex items-center gap-2.5 text-sm text-white/45">
                <PhoneIcon className="h-4 w-4 text-orange-400 shrink-0" />
                +591 XXX XXXX
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-white/25 text-xs uppercase tracking-widest">Sistema interno</p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition-colors group shadow-lg shadow-orange-500/15"
              >
                Acceder al sistema
                <ArrowRightIcon className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="mt-12 pt-7 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/18">
            <span>© {new Date().getFullYear()} Osefi SRL — Todos los derechos reservados.</span>
            <span className="uppercase tracking-widest">Bolivia · Telecomunicaciones</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
