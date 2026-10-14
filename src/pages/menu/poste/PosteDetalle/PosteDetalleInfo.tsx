import { toast } from "sonner";
import { PosteInterface } from "../../../../interfaces/interfaces";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Building2Icon, CableIcon, CalendarIcon, CopyIcon, ImageIcon, LayersIcon, MapPinIcon, UserIcon,
} from "lucide-react";
import Dato from "../../../../components/Dato";
import { FOTO_CABECERA_ALTO } from "../../../../components/fotoCabecera";
import DatoTramo from "../../tramo/DatoTramo";
import { ImageViewer } from "../../../../components/ui/image-viewer";
import { imageUrl } from "../../../../lib/imageUrl";
import { hasCoords } from "../../../../components/map/mapGeo";
import { HealthMetrics } from "./posteHealth";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  /** `null` for a role that may not see incidents: both figures are made of them. */
  metrics: HealthMetrics | null;
  /** Whether the tramo's name leads to its own card. */
  canVerTramos: boolean;
}

/**
 * The pole's photograph, across the top of its card. Pressing it opens the
 * whole picture. Its height is the one every detail panel shares — see
 * `FOTO_CABECERA_ALTO` for why that and not 16:9.
 */
export function PosteDetalleFoto({ loading, poste }: Pick<Props, "loading" | "poste">) {
  return (
    <div className={`relative ${FOTO_CABECERA_ALTO} w-full shrink-0 bg-muted`}>
      {loading ? (
        <Skeleton className="absolute inset-0 rounded-none" />
      ) : poste?.image ? (
        <ImageViewer src={imageUrl(poste.image) ?? ""} alt={`Poste ${poste.name}`} hero />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-muted-foreground/40">
          <ImageIcon className="h-5 w-5" strokeWidth={1.5} />
          <span className="text-xs">Sin imagen</span>
        </div>
      )}
    </div>
  );
}

/**
 * What the pole is: two figures about how its incidents close, the tramo it
 * belongs to, what it is made of and whose it is, and where it stands — the last one copies on a press,
 * because a crew pastes it into a map more often than it reads it.
 */
export default function PosteDetalleInfo({ loading, poste, metrics, canVerTramos }: Props) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <Skeleton className="h-8 col-span-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      </div>
    );
  }

  const coords = poste && hasCoords(poste)
    ? `${poste.lat.toFixed(5)}, ${poste.lng.toFixed(5)}`
    : null;

  const copiarCoords = () => {
    if (!coords) return;
    navigator.clipboard.writeText(coords)
      .then(() => toast.success("Coordenadas copiadas"))
      .catch(() => toast.error("No se pudieron copiar las coordenadas"));
  };

  return (
    <div className="space-y-3">
      {metrics && (
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Cierre medio"
            title="Lo que tardan de media en cerrarse los eventos resueltos de este poste."
            value={metrics.mttrDays !== null ? metrics.mttrDays.toLocaleString("es-ES") : "—"}
            unit={metrics.mttrDays === null ? undefined : metrics.mttrDays === 1 ? "día" : "días"}
          />
          <Stat
            label="Resueltos"
            value={String(metrics.totalResueltos)}
            unit={`de ${metrics.totalResueltos + metrics.pendientes}`}
          />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        <DatoTramo tramo={poste?.tramo} canVerTramos={canVerTramos} />
        <Dato icon={<LayersIcon />} label="Material">{poste?.material?.name}</Dato>
        <Dato icon={<Building2Icon />} label="Propietario">{poste?.propietario?.name}</Dato>
        {poste?.adss?.name && <Dato icon={<CableIcon />} label="Ferretería">{poste.adss.name}</Dato>}
        <Dato icon={<CalendarIcon />} label="Registrado">
          {poste?.date ? new Date(poste.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : undefined}
        </Dato>
        <Dato icon={<UserIcon />} label="Registrado por">
          {poste?.usuario ? `${poste.usuario.name} ${poste.usuario.lastname}` : undefined}
        </Dato>
      </dl>

      {coords && (
        <button
          type="button"
          onClick={copiarCoords}
          aria-label={`Copiar coordenadas ${coords}`}
          className="group w-full flex items-center gap-2 rounded-lg border border-dashed border-border px-2.5 py-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 -outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="flex-1 min-w-0 truncate font-mono text-xs tabular-nums">{coords}</span>
          <CopyIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        </button>
      )}
    </div>
  );
}

function Stat({
  label, value, unit, title,
}: {
  label: string;
  value: string;
  unit?: string;
  title?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2 min-w-0" title={title}>
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="flex items-baseline gap-1 min-w-0">
        <span className="text-xl font-semibold leading-tight tabular-nums">{value}</span>
        {unit && <span className="text-xs text-muted-foreground truncate">{unit}</span>}
      </p>
    </div>
  );
}
