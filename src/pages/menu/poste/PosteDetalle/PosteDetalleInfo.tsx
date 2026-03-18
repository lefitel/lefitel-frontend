import { PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Skeleton } from "../../../../components/ui/skeleton";
import { CalendarIcon, ChevronRightIcon, MapPinIcon, UserIcon, ZapIcon } from "lucide-react";
import { ImageViewer } from "../../../../components/ui/image-viewer";
import { url } from "../../../../api/url";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
}

export default function PosteDetalleInfo({ loading, poste }: Props) {
  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base">Información del poste</CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          ))
        ) : (
          <>
            <InfoRow icon={<MapPinIcon className="h-4 w-4 text-primary" />} bg="bg-primary/10" label="Tramo" value={<>{poste?.ciudadA?.name ?? "—"} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" /> {poste?.ciudadB?.name ?? "—"}</>} />
            <InfoRow icon={<ZapIcon className="h-4 w-4 text-primary" />} bg="bg-primary/10" label="Material" value={poste?.material?.name ?? "—"} />
            <InfoRow icon={<UserIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Propietario" value={poste?.propietario?.name ?? "—"} />
            <InfoRow icon={<UserIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Registrado por" value={poste?.usuario ? `${poste.usuario.name} ${poste.usuario.lastname}` : "—"} />
            <InfoRow icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Fecha de registro" value={poste?.date ? new Date(poste.date).toLocaleDateString("es-ES") : "—"} />
            {poste?.adss?.name && (
              <InfoRow icon={<ZapIcon className="h-4 w-4 text-muted-foreground" />} bg="bg-muted" label="Ferretería (ADSS)" value={poste.adss.name} />
            )}
            <div className="pt-1 flex gap-2 text-xs text-muted-foreground">
              <span>Lat: {poste?.lat ?? "—"}</span>
              <span>·</span>
              <span>Lng: {poste?.lng ?? "—"}</span>
            </div>
            {poste?.image && (
              <div className="pt-2">
                <ImageViewer src={`${url}${poste.image}`} alt={`Poste ${poste.name}`} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`p-2 ${bg} rounded-full shrink-0`}>{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
