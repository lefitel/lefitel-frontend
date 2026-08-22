import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "motion/react";
import { EXPO, QUART } from "./tokens";
import { usePrefersReducedMotion } from "./useTimeline";

/**
 * The small parts every piece of the showcase shares.
 *
 * There is no window frame here any more. The section used to be one browser
 * chrome with four screens cycling inside it, which meant a whole 940-pixel
 * screen had to be shrunk to phone width, where none of it could be read. The
 * pieces now stand on their own at their real size, labelled with where they
 * live in the application, so a phone gets a legible card instead of an
 * illegible screenshot.
 */

/**
 * The scripted pointer.
 *
 * It appears only in the pieces where something is being operated: a filter
 * switched, a form filled, a column picked. In the pieces that merely draw
 * their data it was noise, so it stays away.
 *
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
        x: { duration: 0.5, ease: EXPO },
        y: { duration: 0.5, ease: EXPO },
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

/**
 * A number that rolls to its new value.
 *
 * Writes straight to the DOM node instead of through state: the totals piece
 * shows five of these at once, and re-rendering to move five digits sixty times
 * a second is how a landing page starts dropping frames.
 */
export function Counter({
  to,
  duration = 1.1,
  still = false,
}: {
  to: number;
  duration?: number;
  still?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const text = (v: number) => Math.round(v).toLocaleString("es-BO");

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
  }, [to, still, duration]);

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

/** The application success notice. */
export function Toast({ show, title, detail }: { show: boolean; title: string; detail: string }) {
  return (
    <motion.div
      className="flex w-[250px] max-w-full items-start gap-2.5 rounded-lg border border-[var(--scr-ok)]/35 bg-[var(--scr-panel)] px-3 py-2.5 shadow-[0_16px_40px_-16px_oklch(0_0_0/0.9)]"
      initial={false}
      animate={show ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 24, scale: 0.97 }}
      transition={{ duration: 0.42, ease: EXPO }}
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

/**
 * Lifts its contents into place the first time they scroll into view.
 *
 * Every caption and every piece arrives this way, the caption a moment ahead of
 * its piece, so a beat reads as one thing appearing rather than as two that
 * happened to be there already. Only opacity and vertical offset move: the
 * pointer measures its targets against this same element, and a translate
 * cancels out of that subtraction where a scale would not.
 */
export function Reveal({
  delay = 0,
  className = "",
  children,
}: {
  delay?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const still = usePrefersReducedMotion();
  const shown = onScreen || still;

  // `initial` stays constant. Swapping it after mount is not something motion
  // acts on, so a piece that decided late that it should not animate stayed at
  // the hidden values for good. Reduced motion is expressed as a zero-length
  // transition instead, which lands on the same frame without the movement.
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      transition={still ? { duration: 0 } : { duration: 0.7, ease: EXPO, delay }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The surface a piece sits on: one box per piece, always.
 *
 * A beat made of three cards standing loose on the page background reads as
 * three unrelated things. Everything a piece is made of goes inside a single
 * panel, and where it needs internal divisions they are hairlines, not more
 * boxes. The trick throughout is a one-pixel grid gap over the hairline colour,
 * which draws a clean rule between cells in any arrangement without any of them
 * becoming a card of its own.
 */
export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--scr-hair)] bg-[var(--scr-panel)] ${className}`}
    >
      {children}
    </div>
  );
}
