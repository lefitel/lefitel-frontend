import { PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { ImageIcon } from "lucide-react";
import { ImageViewer } from "../../../../components/ui/image-viewer";
import { url } from "../../../../api/url";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
}

export default function PosteDetalleInfo({ loading, poste }: Props) {
  return (
    <Card className="shadow-sm border-muted/60 overflow-hidden flex flex-col h-full py-0 gap-0">
      {/* Hero image */}
      <div className="aspect-16/10 bg-muted relative shrink-0 border-b border-border/40">
        {loading ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : poste?.image ? (
          <ImageViewer src={`${url}${poste.image}`} alt={`Poste ${poste.name}`} hero />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
            <ImageIcon className="h-10 w-10" strokeWidth={1.5} />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Datos */}
      <CardContent className="p-5 flex-1">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <dl className="space-y-3.5">
            <Row label="Material" value={poste?.material?.name} />
            <Row label="Propietario" value={poste?.propietario?.name} />
            {poste?.adss?.name && <Row label="Ferretería" value={poste.adss.name} />}
            <Row
              label="Registrado"
              value={poste?.date ? new Date(poste.date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : undefined}
            />
            <Row
              label="Registrado por"
              value={poste?.usuario ? `${poste.usuario.name} ${poste.usuario.lastname}` : undefined}
            />
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 min-w-0">
      <dt className="text-xs text-muted-foreground font-medium shrink-0">{label}</dt>
      <dd className="text-sm font-medium truncate text-right">{value ?? "—"}</dd>
    </div>
  );
}
