import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneIcon } from "lucide-react";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "../segundoFactor/CampoDialogo";
import { ariaCampo } from "../segundoFactor/ariaCampo";
import type { DatosPersonales } from "./datosPersonales";
import { useBorradorDialogo } from "./useBorradorDialogo";

interface Props {
  open: boolean;
  onClose: () => void;
  /** What the record has now; the draft starts from it each time the dialog opens. */
  datos: DatosPersonales;
  /** Saves; `true` closes the dialog, `false` leaves it open as it is. */
  onGuardar: (valores: DatosPersonales) => Promise<boolean>;
}

/**
 * Name, surname, phone and date of birth in one dialog, because they are one
 * thought — "my details are wrong" — and nobody sets out to change only their
 * surname. Name and surname are the two the server will not take empty.
 */
export default function PersonalDialog({ open, onClose, datos, onGuardar }: Props) {
  const { borrador, poner, intentado, guardando, enviar } = useBorradorDialogo(open, datos);

  const errores = {
    name: borrador.name.trim() ? null : "El nombre es obligatorio.",
    lastname: borrador.lastname.trim() ? null : "Los apellidos son obligatorios.",
  };
  const ver = (campo: keyof typeof errores) => (intentado ? errores[campo] : null);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="md"
      title="Información personal"
      description="Tu nombre, tu teléfono y tu fecha de nacimiento."
      dirty={(Object.keys(datos) as (keyof DatosPersonales)[]).some((k) => borrador[k] !== datos[k])}
      missing={[!borrador.name.trim() && "Nombres", !borrador.lastname.trim() && "Apellidos"].filter(
        (c): c is string => !!c,
      )}
      saving={guardando}
      submitLabel="Guardar"
      onSubmit={() => void enviar(Object.values(errores).some(Boolean), () => onGuardar(borrador), onClose)}
      bodyClassName="space-y-4"
    >
      <CampoDialogo id="perfil-name" label="Nombres" requerido error={ver("name")}>
        <Input
          id="perfil-name"
          value={borrador.name}
          onChange={(e) => poner("name", e.target.value)}
          placeholder="Ej: Juan"
          {...ariaCampo("perfil-name", ver("name"))}
        />
      </CampoDialogo>

      <CampoDialogo id="perfil-lastname" label="Apellidos" requerido error={ver("lastname")}>
        <Input
          id="perfil-lastname"
          value={borrador.lastname}
          onChange={(e) => poner("lastname", e.target.value)}
          placeholder="Ej: Pérez"
          {...ariaCampo("perfil-lastname", ver("lastname"))}
        />
      </CampoDialogo>

      <CampoDialogo id="perfil-phone" label="Teléfono">
        <div className="relative">
          <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            id="perfil-phone"
            value={borrador.phone}
            onChange={(e) => poner("phone", e.target.value)}
            className="pl-8"
            placeholder="+591 77777777"
          />
        </div>
      </CampoDialogo>

      <CampoDialogo id="perfil-birthday" label="Fecha de nacimiento">
        <DatePicker
          value={borrador.birthday ? new Date(borrador.birthday + "T00:00:00") : undefined}
          onSelect={(d) => poner("birthday", d ? d.toISOString().slice(0, 10) : "")}
        />
      </CampoDialogo>
    </FormDialog>
  );
}
