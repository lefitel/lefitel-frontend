import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PencilIcon, UserIcon } from "lucide-react";
import type { DatosPersonales } from "./datosPersonales";
import { ReadRow } from "./perfilRows";

interface Props {
  datos: DatosPersonales;
  onEditar: () => void;
}

/** `1990-01-01` → `1 de enero de 1990`, or a dash when there is nothing. */
function fecha(iso: string): string {
  if (!iso) return "—";
  // Midnight local, not `new Date("1990-01-01")` — that parses as UTC and shows
  // the day before for everybody west of Greenwich, which is all of Bolivia.
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/** Whole years since `iso`, or null when there is no date to count from. */
function edad(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  const años = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  return años >= 0 && años < 150 ? años : null;
}

/**
 * Name, phone and date of birth, read-only: the part of this page that is only
 * information, with nothing behind it that can lock anybody out.
 *
 * All four fields are edited together, in `PersonalDialog`, because they are
 * one thought — "my details are wrong" — and nobody sets out to change only
 * their surname. The credentials below open one dialog each for the opposite
 * reason: each has a different consequence.
 */
export default function PerfilPersonal({ datos, onEditar }: Props) {
  const años = edad(datos.birthday);

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          Información personal
          <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onEditar}>
            <PencilIcon className="h-3.5 w-3.5" />
            Editar
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-1">
        <div>
          <ReadRow label="Nombre">
            {datos.name || datos.lastname ? `${datos.name} ${datos.lastname}`.trim() : "—"}
          </ReadRow>
          <ReadRow label="Teléfono">
            {datos.phone || <span className="text-muted-foreground">Sin registrar</span>}
          </ReadRow>
          <ReadRow label="Fecha de nacimiento">
            {fecha(datos.birthday)}
            {años !== null && <span className="text-xs text-muted-foreground">{años} años</span>}
          </ReadRow>
        </div>
      </CardContent>
    </Card>
  );
}
