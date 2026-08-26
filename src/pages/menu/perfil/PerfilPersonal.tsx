import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { PencilIcon, PhoneIcon, UserIcon } from "lucide-react";
import { ReadRow, EditorBlock, EditorField } from "./perfilRows";

export interface DatosPersonales {
  name: string;
  lastname: string;
  phone: string;
  /** `YYYY-MM-DD`, the shape `editUsuario` and the date picker both work in. */
  birthday: string;
}

interface Props {
  datos: DatosPersonales;
  editando: boolean;
  guardando: boolean;
  onCampo: (campo: keyof DatosPersonales, valor: string) => void;
  onAbrir: () => void;
  onCancelar: () => void;
  onGuardar: () => void;
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
 * Name, phone and date of birth: the part of this page that is only
 * information, with nothing behind it that can lock anybody out.
 *
 * All four fields open and close together under one Edit button, unlike the
 * credentials below, because they are one thought — "my details are wrong" —
 * and nobody sets out to change only their surname. The three credentials open
 * one at a time for the opposite reason: each has a different consequence and
 * each is confirmed separately.
 *
 * **No confirmation dialog on save, deliberately.** There used to be one. With
 * the fields open behind an explicit Edit and an explicit Save, the dialog was
 * asking somebody to agree to something they had already said twice, about
 * data that can be typed back in a moment. The three credential editors keep
 * theirs, because there the consequence is not reversible by retyping.
 */
export default function PerfilPersonal({
  datos,
  editando,
  guardando,
  onCampo,
  onAbrir,
  onCancelar,
  onGuardar,
}: Props) {
  const años = edad(datos.birthday);

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          Información personal
          {!editando && (
            <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onAbrir}>
              <PencilIcon className="h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-1">
        {editando ? (
          <EditorBlock
            titulo="Información personal"
            icon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
            guardando={guardando}
            guardarLabel="Guardar cambios"
            onGuardar={onGuardar}
            onCancelar={onCancelar}
          >
            <EditorField id="name" label="Nombres" requerido>
              <Input id="name" value={datos.name} onChange={(e) => onCampo("name", e.target.value)} placeholder="Ej: Juan" />
            </EditorField>

            <EditorField id="lastname" label="Apellidos" requerido>
              <Input id="lastname" value={datos.lastname} onChange={(e) => onCampo("lastname", e.target.value)} placeholder="Ej: Pérez" />
            </EditorField>

            <EditorField id="phone" label="Teléfono">
              <div className="relative">
                <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  id="phone"
                  value={datos.phone}
                  onChange={(e) => onCampo("phone", e.target.value)}
                  className="pl-8"
                  placeholder="+591 77777777"
                />
              </div>
            </EditorField>

            <EditorField id="birthday" label="Fecha de nacimiento">
              <DatePicker
                value={datos.birthday ? new Date(datos.birthday + "T00:00:00") : undefined}
                onSelect={(d) => onCampo("birthday", d ? d.toISOString().slice(0, 10) : "")}
              />
            </EditorField>
          </EditorBlock>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
