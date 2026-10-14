import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { pillThumb, pillTrack } from "../../../components/ui/tabs";

export type Estado = "activos" | "archivados";

const ESTADOS: { estado: Estado; texto: string; a: string }[] = [
  { estado: "activos", texto: "Activos", a: "/app/tramos" },
  { estado: "archivados", texto: "Archivados", a: "/app/tramos/archivados" },
];

/**
 * Activos / Archivados for the Tramos screen, drawn in the app's header (see
 * `HeaderSlot`), hence the 32px.
 *
 * Everywhere else this pair is a tab list over one table. Here the two are
 * different screens — the live tramos are worked on the map, the archived ones
 * are a plain list — and so two addresses: links, wearing the app's tab skin.
 */
export default function EstadoTramos({ actual }: { actual: Estado }) {
  return (
    <nav aria-label="Estado de los tramos" className={cn("inline-flex h-8 shrink-0 items-center p-0.5", pillTrack)}>
      {ESTADOS.map(({ estado, texto, a }) => {
        const activo = estado === actual;
        return (
          <Link
            key={estado}
            to={a}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "relative inline-flex h-full items-center justify-center rounded-full border border-transparent px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
              activo
                ? "text-foreground"
                : "text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground",
            )}
          >
            {activo && <span className={pillThumb} />}
            <span className="relative z-10">{texto}</span>
          </Link>
        );
      })}
    </nav>
  );
}
