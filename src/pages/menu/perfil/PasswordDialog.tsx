import { Input } from "@/components/ui/input";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "../segundoFactor/CampoDialogo";
import { ariaCampo } from "../segundoFactor/ariaCampo";
import { PASSWORD_MIN_LENGTH, passwordLengthError } from "../../../lib/password";
import { useBorradorDialogo } from "./useBorradorDialogo";

export interface DatosPassword {
  oldPass: string;
  pass: string;
  confirmPass: string;
}

const VACIO: DatosPassword = { oldPass: "", pass: "", confirmPass: "" };

interface Props {
  open: boolean;
  onClose: () => void;
  /** The account's name, handed to the browser's password manager and shown to nobody. */
  usuario: string;
  /** Saves; `true` closes the dialog, `false` leaves it open as it is. */
  onGuardar: (valores: DatosPassword) => Promise<boolean>;
}

/**
 * Change your password. The current one is not a confirmation of identity here,
 * it is half of what is being changed, so it is asked for in the dialog; the
 * step-up gate in front of the route is a separate question and has its own.
 *
 * **The length is checked here, before anything is sent.** The server's own
 * rule, taken from the one place it lives on this side — `lib/password.ts` —
 * and not a number typed in here.
 *
 * This check once said `< 6` while the server demanded twelve, and the gap was
 * declared harmless because "the server rejects correctly, so no weak
 * password gets in". What that reasoning missed is the price of the rejection:
 * the refusal costs one of the five password confirmations this account gets
 * per quarter of an hour, the token is taken *before* the server looks at the
 * new password, and the same ration also pays for renaming yourself. So
 * somebody who reacts to "at least 12 characters" the way people do — nine,
 * then ten, then eleven — is told to wait fifteen minutes for having corrected
 * their own typing, and cannot change their username either.
 *
 * **The invisible username field** is there for the browser's password manager:
 * it offers to update the entry for this account only when it can see which
 * account the password it is looking at belongs to.
 */
export default function PasswordDialog({ open, onClose, usuario, onGuardar }: Props) {
  const { borrador, poner, intentado, guardando, enviar } = useBorradorDialogo(open, VACIO, {
    soltarAlCerrar: true,
  });

  const errores = {
    oldPass: borrador.oldPass ? null : "Escribe tu contraseña actual.",
    pass: !borrador.pass ? "Escribe la nueva contraseña." : passwordLengthError(borrador.pass),
    confirmPass: !borrador.confirmPass
      ? "Repite la nueva contraseña."
      : borrador.confirmPass !== borrador.pass
        ? "Las contraseñas no coinciden."
        : null,
  };
  const ver = (campo: keyof typeof errores) => (intentado ? errores[campo] : null);

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Cambiar contraseña"
      description="Necesitamos la actual para comprobar que eres tú."
      dirty={Object.values(borrador).some((v) => v !== "")}
      missing={[
        !borrador.oldPass && "Contraseña actual",
        !borrador.pass && "Nueva contraseña",
        !borrador.confirmPass && "Confirmar nueva contraseña",
      ].filter((c): c is string => !!c)}
      saving={guardando}
      submitLabel="Guardar"
      onSubmit={() => void enviar(Object.values(errores).some(Boolean), () => onGuardar(borrador), onClose)}
      bodyClassName="space-y-4"
    >
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={usuario}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        data-no-autofocus
        className="sr-only"
      />

      <CampoDialogo id="perfil-oldPass" label="Contraseña actual" requerido error={ver("oldPass")}>
        <Input
          id="perfil-oldPass"
          type="password"
          autoComplete="current-password"
          value={borrador.oldPass}
          onChange={(e) => poner("oldPass", e.target.value)}
          className="font-mono"
          placeholder="••••••••"
          {...ariaCampo("perfil-oldPass", ver("oldPass"))}
        />
      </CampoDialogo>

      <CampoDialogo
        id="perfil-pass"
        label="Nueva contraseña"
        requerido
        ayuda={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}
        error={ver("pass")}
      >
        <Input
          id="perfil-pass"
          type="password"
          autoComplete="new-password"
          value={borrador.pass}
          onChange={(e) => poner("pass", e.target.value)}
          className="font-mono"
          placeholder="••••••••"
          {...ariaCampo("perfil-pass", ver("pass"))}
        />
      </CampoDialogo>

      <CampoDialogo id="perfil-confirmPass" label="Confirmar nueva contraseña" requerido error={ver("confirmPass")}>
        <Input
          id="perfil-confirmPass"
          type="password"
          autoComplete="new-password"
          value={borrador.confirmPass}
          onChange={(e) => poner("confirmPass", e.target.value)}
          className="font-mono"
          placeholder="••••••••"
          {...ariaCampo("perfil-confirmPass", ver("confirmPass"))}
        />
      </CampoDialogo>

      <p className="text-xs text-muted-foreground">
        Nadie, tampoco el equipo de Osefi, puede ver tu contraseña.
      </p>
    </FormDialog>
  );
}
