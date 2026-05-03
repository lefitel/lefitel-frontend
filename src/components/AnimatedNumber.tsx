import { useEffect, useState } from "react";
import { animate } from "motion";

interface AnimatedNumberProps {
  value: number;
  /** Duration in seconds */
  duration?: number;
  /** Optional formatter (e.g. for adding suffixes like %) */
  format?: (n: number) => string;
}

export function AnimatedNumber({ value, duration = 0.8, format }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(display, value, {
      duration,
      ease: [0.16, 1, 0.3, 1], // ease-out cubic-ish
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{format ? format(display) : display}</>;
}
