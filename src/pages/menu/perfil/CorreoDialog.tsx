import { Input } from "@/components/ui/input";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "../segundoFactor/CampoDialogo";
import { ariaCampo } from "../segundoFactor/ariaCampo";
import { useBorradorDialogo } from "./useBorradorDialogo";

/**
 * The same loose, non-RFC shape check `email.controller.ts` runs server-side
 * (`EMAIL_SHAPE` there). Copied rather than shared — the two repositories
 * cannot import from each other — and kept deliberately loose for the same
 * reason the server's is: this is a cheap filter against an obvious typo, not
 * a security boundary. The server is still the one that decides whether an
 * address is acceptable; this only saves a round trip and a rate-limit charge.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
  /** The address on file, or `null` when there is none. */
  email: string | null;
  /** Whether the address on file has been confirmed. */
  verificado: boolean;
  /** Sends the link; `true` closes the dialog, `false` leaves it open as it is. */
  onGuardar: (email: string) => Promise<boolean>;
}

/**
 * Set or change the recovery address, which sends a verification link to it.
 *
 * The address is checked here and the identity is not, which is the split this
 * screen settled on: a malformed address is worth catching before the round
 * trip, while the password is the step-up gate's business — it asks on the way
 * out, from its own dialog, and asking here as well would be the same secret
 * typed twice for one send.
 *
 * The button says "Reenviar" when the box still holds the unverified address on
 * file. It only picks the wording: the request is identical either way, because
 * the server nulls `email_verified_at` on every successful send.
 */
export default function CorreoDialog({ open, onClose, email, verificado, onGuardar }: Props) {
  const enArchivo = email ?? "";
  const { borrador, poner, intentado, guardando, enviar } = useBorradorDialogo(open, { email: enArchivo });

  const direccion = borrador.email.trim();
  const error = !direccion
    ? "Debes indicar una dirección de correo."
    : !EMAIL_SHAPE.test(direccion)
      ? "Debes indicar una dirección de correo válida."
      : null;
  const ver = intentado ? error : null;

  const reenvio = !!email && !verificado && direccion === email;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Correo de recuperación"
      description={
        <>
          {verificado && (
            <>
              Tu dirección actual, ya verificada, quedará sin verificar hasta que confirmes la nueva,
              y avisaremos a esa misma casilla del cambio.{" "}
            </>
          )}
          Te enviaremos un enlace; hasta que lo abras, la dirección no sirve para recuperar tu cuenta.
        </>
      }
      dirty={direccion !== enArchivo}
      missing={!direccion ? ["Dirección de correo"] : []}
      saving={guardando}
      submitLabel={reenvio ? "Reenviar enlace" : "Enviar enlace"}
      savingLabel="Enviando…"
      onSubmit={() => void enviar(!!error, () => onGuardar(direccion), onClose)}
      bodyClassName="space-y-4"
    >
      <CampoDialogo
        id="perfil-email"
        label="Dirección de correo"
        requerido
        ayuda="Sirve para recuperar tu cuenta si olvidas la contraseña y, una vez verificado, es también tu segundo factor: podrás entrar con un código enviado aquí."
        error={ver}
      >
        <Input
          id="perfil-email"
          type="email"
          value={borrador.email}
          onChange={(e) => poner("email", e.target.value)}
          placeholder="tu.correo@ejemplo.com"
          autoComplete="email"
          {...ariaCampo("perfil-email", ver)}
        />
      </CampoDialogo>
    </FormDialog>
  );
}
