import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import {
  BarChart3Icon,
  Building2Icon,
  LayoutDashboardIcon,
  RadioTowerIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  Table2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { EXPO, QUART, STAGE_H, STAGE_W, screenVars } from "./tokens";

/**
 * The shell every scene is drawn inside, and the small pieces they all share.
 *
 * Two ideas hold this file together. The first: scenes are composed at one
 * fixed size and scaled to whatever room the page gives them. Laying out four
 * dense product screens responsively would mean designing each of them four
 * times; scaling means designing each once, at coordinates that can be
 * hard-coded, and that is what makes a scripted cursor possible at all — it has
 * to know where things are.
 *
 * The second: the window is the brand, the screen inside it is the product. The
 * frame borrows the landing page orange. Everything within uses the
 * application's own slate and its own semantic colours, the same red-to-blue
 * criticality scale the technicians read in the field. Painting the product
 * orange to match the poster would be a lie about what the tool looks like.
 */
// ── Stage ────────────────────────────────────────────────────────────────────

/**
 * Holds a 940×580 composition and shrinks it to the width available.
 *
 * The wrapper carries the aspect ratio so the page reserves the right height
 * before the observer has measured anything. Without it the section jumps once
 * on load, which is the one moment a landing page cannot afford to look cheap.
 */
export function Stage({ children }: { children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / STAGE_W));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} className="relative w-full" style={{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }}>
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Window frame ─────────────────────────────────────────────────────────────

const RAIL = [
  { id: "home", icon: LayoutDashboardIcon },
  { id: "postes", icon: RadioTowerIcon },
  { id: "ciudades", icon: Building2Icon },
  { id: "eventos", icon: TriangleAlertIcon },
  { id: "reportes", icon: BarChart3Icon },
  { id: "generador", icon: Table2Icon },
  { id: "bitacora", icon: ScrollTextIcon },
  { id: "seguridad", icon: ShieldCheckIcon },
] as const;

export type RailId = (typeof RAIL)[number]["id"];

export function AppFrame({
  route,
  active,
  children,
}: {
  route: string;
  active: RailId;
  children: React.ReactNode;
}) {
  return (
    <div
      style={screenVars}
      className="h-full w-full overflow-hidden rounded-[14px] border border-white/10 bg-[var(--scr-bg)] shadow-[0_40px_90px_-30px_oklch(0_0_0/0.85)]"
    >
      <div className="flex h-9 items-center gap-3 border-b border-[var(--scr-hair)] bg-[var(--scr-panel)] px-3.5">
        <div className="flex gap-[6px]">
          <span className="h-[9px] w-[9px] rounded-full bg-[oklch(0.62_0.16_25)]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[oklch(0.76_0.14_85)]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[oklch(0.72_0.13_150)]" />
        </div>
        <div className="mx-auto flex h-[22px] min-w-[280px] items-center justify-center gap-2 rounded-md bg-[var(--scr-bg)] px-3 text-[11px] text-[var(--scr-faint)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--scr-ok)]" />
          <span className="tracking-tight tabular-nums">{route}</span>
        </div>
        <div className="w-[42px]" />
      </div>

      <div className="flex h-[calc(100%-36px)]">
        <div className="flex w-[52px] shrink-0 flex-col items-center gap-1.5 border-r border-[var(--scr-hair)] bg-[var(--scr-panel)] py-3">
          <div className="mb-2 grid h-7 w-7 place-items-center rounded-lg bg-orange-500/15 text-[10px] font-bold text-orange-400">
            O
          </div>
          {RAIL.map(({ id, icon: Icon }) => {
            const on = id === active;
            return (
              <div
                key={id}
                className={`grid h-8 w-8 place-items-center rounded-lg transition-colors duration-300 ${
                  on ? "bg-[var(--scr-raise)] text-[var(--scr-text)]" : "text-[var(--scr-faint)]"
                }`}
              >
                <Icon className="h-[15px] w-[15px]" strokeWidth={on ? 2.1 : 1.7} />
              </div>
            );
          })}
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}

// ── Cursor ───────────────────────────────────────────────────────────────────

/**
 * The scripted pointer.
 *
 * It is what turns four still screens into four demonstrations: a viewer reads
 * "someone is using this" from a moving arrow long before they read any label.
 * `press` is a counter rather than a flag so that clicking the same spot twice
 * replays the ring; a boolean would sit at true and show nothing the second
 * time.
 */
export function Cursor({
  x,
  y,
  press = 0,
  hidden = false,
}: {
  x: number;
  y: number;
  press?: number;
  hidden?: boolean;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute top-0 left-0 z-50"
      initial={false}
      animate={{ x, y, opacity: hidden ? 0 : 1 }}
      transition={{
        x: { duration: 0.55, ease: EXPO },
        y: { duration: 0.55, ease: EXPO },
        opacity: { duration: 0.25 },
      }}
    >
      {press > 0 && (
        <motion.span
          key={press}
          className="absolute -top-2 -left-2 block h-8 w-8 rounded-full border border-orange-300/70"
          initial={{ scale: 0.3, opacity: 0.85 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.55, ease: QUART }}
        />
      )}
      <motion.svg
        key={`tip-${press}`}
        width="19"
        height="23"
        viewBox="0 0 19 23"
        fill="none"
        animate={{ scale: press > 0 ? [1, 0.86, 1] : 1 }}
        transition={{ duration: 0.22, ease: QUART }}
      >
        <path
          d="M2 1.6 L2 18.2 L6.3 14.2 L9.1 21 L12.4 19.6 L9.6 12.9 L15.4 12.6 Z"
          fill="oklch(0.99 0 0)"
          stroke="oklch(0.15 0.01 258)"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}

// ── Small parts ──────────────────────────────────────────────────────────────

/**
 * A number that rolls to its new value.
 *
 * Writes straight to the DOM node instead of through state: the dashboard scene
 * shows five of these at once, and re-rendering the screen sixty times a second
 * to move five digits is how a landing page starts dropping frames.
 */
export function Counter({
  to,
  duration = 1.1,
  decimals = 0,
  still = false,
}: {
  to: number;
  duration?: number;
  decimals?: number;
  still?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const text = (v: number) =>
      v.toLocaleString("es-BO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    if (still) {
      node.textContent = text(to);
      from.current = to;
      return;
    }
    const controls = animate(from.current, to, {
      duration,
      ease: EXPO,
      onUpdate: (v) => {
        node.textContent = text(v);
      },
    });
    from.current = to;
    return () => controls.stop();
  }, [to, still, duration, decimals]);

  return <span ref={ref} className="tabular-nums" />;
}

/** Text that appears a character at a time, as if someone were typing it. */
export function Typewriter({
  text,
  active,
  still = false,
  cps = 30,
  className = "",
}: {
  text: string;
  active: boolean;
  still?: boolean;
  cps?: number;
  className?: string;
}) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (still) {
      setShown(text.length);
      return;
    }
    if (!active) {
      setShown(0);
      return;
    }
    setShown(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [active, text, cps, still]);

  return (
    <span className={className}>
      {text.slice(0, shown)}
      {active && !still && shown < text.length && (
        <span className="ml-px inline-block h-[1em] w-px translate-y-[2px] bg-[var(--scr-text)] align-middle" />
      )}
    </span>
  );
}

/** The application success notice, in the corner it really appears in. */
export function Toast({ show, title, detail }: { show: boolean; title: string; detail: string }) {
  return (
    <motion.div
      className="absolute top-3 right-3 z-40 flex w-[248px] items-start gap-2.5 rounded-lg border border-[var(--scr-ok)]/35 bg-[var(--scr-panel)] px-3 py-2.5 shadow-[0_16px_40px_-16px_oklch(0_0_0/0.9)]"
      initial={false}
      animate={show ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: show ? 0.42 : 0.28, ease: EXPO }}
    >
      <span className="mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--scr-ok)]">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
          <path
            d="M1.6 5.2 L3.9 7.4 L8.4 2.6"
            stroke="oklch(0.16 0.02 162)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-[var(--scr-text)]">{title}</p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--scr-faint)]">{detail}</p>
      </div>
    </motion.div>
  );
}

/** Page heading inside a screen: title, subtitle, and whatever sits at the end. */
export function ScreenHead({
  title,
  sub,
  right,
}: {
  title: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
      <div>
        <h3 className="text-[17px] leading-tight font-bold tracking-tight text-[var(--scr-text)]">{title}</h3>
        <p className="mt-1 text-[11.5px] text-[var(--scr-faint)]">{sub}</p>
      </div>
      {right}
    </div>
  );
}

/** The segmented control the application uses for mutually exclusive views. */
export function Segmented({
  options,
  value,
  className = "",
}: {
  options: readonly string[];
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`relative flex items-center gap-0.5 rounded-lg border border-[var(--scr-hair)] bg-[var(--scr-panel)] p-0.5 ${className}`}
    >
      {options.map((option) => {
        const on = option === value;
        return (
          <div key={option} className="relative px-3 py-1">
            {on && (
              <motion.span
                layoutId="segmented-active"
                className="absolute inset-0 rounded-md bg-[var(--scr-raise)]"
                transition={{ duration: 0.32, ease: EXPO }}
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
  );
}
