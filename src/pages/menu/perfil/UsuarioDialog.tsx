import { Input } from "@/components/ui/input";
import FormDialog from "../../../components/dialogs/FormDialog";
import { CampoDialogo } from "../segundoFactor/CampoDialogo";
import { ariaCampo } from "../segundoFactor/ariaCampo";
import { useBorradorDialogo } from "./useBorradorDialogo";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The name the account has now. */
  usuario: string;
  /** Saves; `true` closes the dialog, `false` leaves it open as it is. */
  onGuardar: (usuario: string) => Promise<boolean>;
}

/**
 * Rename the account. Only the name travels: whoever has to prove it is you is
 * the step-up gate in front of the route, which asks once from its own dialog,
 * so a password box here would be the same secret typed twice for one rename.
 *
 * There is no confirmation after this one either; what it would have said is
 * in the description, before the button is pressed.
 */
export default function UsuarioDialog({ open, onClose, usuario, onGuardar }: Props) {
  const { borrador, poner, intentado, guardando, enviar } = useBorradorDialogo(open, { user: usuario });

  const error = borrador.user.trim() ? null : "El nombre de usuario no puede estar vacío.";
  const ver = intentado ? error : null;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Cambiar nombre de usuario"
      description="Entrarás con este nombre a partir de tu próxima sesión. Tu contraseña no cambia."
      dirty={borrador.user !== usuario}
      missing={error ? ["Usuario"] : []}
      saving={guardando}
      submitLabel="Guardar"
      onSubmit={() => void enviar(!!error, () => onGuardar(borrador.user), onClose)}
      bodyClassName="space-y-4"
    >
      <CampoDialogo
        id="perfil-user"
        label="Usuario"
        requerido
        ayuda="Se usa para entrar y aparece en los registros de auditoría."
        error={ver}
      >
        <Input
          id="perfil-user"
          value={borrador.user}
          onChange={(e) => poner("user", e.target.value)}
          className="font-mono"
          autoComplete="username"
          {...ariaCampo("perfil-user", ver)}
        />
      </CampoDialogo>
    </FormDialog>
  );
}
