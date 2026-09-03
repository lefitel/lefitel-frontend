import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FingerprintIcon, KeyIcon, MailCheckIcon, MailIcon, MailWarningIcon, ShieldIcon, SmartphoneIcon,
} from "lucide-react";
import { ReadRow, EditorBlock, EditorField } from "./perfilRows";
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";

export type EditorAcceso = "usuario" | "password" | "email";

export interface DatosCuenta {
  user: string;
  /** The current password the *rename* carries. Never shared with `oldPass`. */
  userPass: string;
  oldPass: string;
  pass: string;
  confirmPass: string;
}

interface Props {
  cuenta: DatosCuenta;
  emailForm: { email: string; pass: string };
  recovery: { email: string | null; verifiedAt: string | null };
  /** Which of the three is open, or null when all three are being read. */
  abierto: EditorAcceso | null;
  guardando: { usuario: boolean; password: boolean; email: boolean };
  onCuenta: (campo: keyof DatosCuenta, valor: string) => void;
  onEmailForm: (campo: "email" | "pass", valor: string) => void;
  onAbrir: (cual: EditorAcceso) => void;
  onCancelar: () => void;
  onGuardarUsuario: () => void;
  onGuardarPassword: () => void;
  onGuardarEmail: () => void;
}

/**
 * The three credentials, each opening on its own.
 *
 * These used to be three separate cards, each with its own "confirm your
 * password" box — three password fields on one screen with no explanation of
 * why there were three. They are one card now, and only one of them is ever
 * open, so the question "which password box am I in" cannot be asked.
 *
 * **Every label and button name here is load-bearing.** `PerfilPage.test.tsx`
 * reaches these fields with `getByLabelText` and these buttons with
 * `getByRole("button", { name })`, both of which throw on an ambiguous match
 * rather than picking one. The rules that keeps:
 *
 * - The three "confirm your password" fields answer to three different
 *   phrases: `Confirma tu contraseña` (rename), `Contraseña actual` (password
 *   change) and `Confirma con tu contraseña` (recovery address). A fourth
 *   field matching any of them would break tests that are about something
 *   else entirely.
 * - No button label may contain "actualizar" except the rename's own, and none
 *   may contain "clave" except the password change's.
 * - The buttons that *open* an editor are named by `aria-label`, not by their
 *   visible "Cambiar": three visible buttons all reading "Cambiar" would be
 *   ambiguous to a test and useless to a screen reader alike.
 */
export default function PerfilAcceso({
  cuenta, emailForm, recovery, abierto, guardando,
  onCuenta, onEmailForm, onAbrir, onCancelar,
  onGuardarUsuario, onGuardarPassword, onGuardarEmail,
}: Props) {
  const emailVerificado = recovery.verifiedAt !== null;

  // Whether the box still reads exactly what the server has on file. Picks the
  // button's wording only — the request is identical either way, because the
  // server nulls `email_verified_at` on every successful send even when the
  // address has not changed.
  const emailSinCambios =
    emailForm.email.trim() !== "" && emailForm.email.trim() === (recovery.email ?? "");

  const emailButtonLabel = !recovery.email
    ? "Verificar correo"
    : !emailVerificado && emailSinCambios
      ? "Reenviar verificación"
      : "Guardar y verificar";

  const botonAbrir = (cual: EditorAcceso, etiqueta: string) => (
    <Button variant="outline" size="sm" aria-label={etiqueta} onClick={() => onAbrir(cual)}>
      Cambiar
    </Button>
  );

  return (
    <Card className="shadow-sm border-muted/60">
      <CardHeader className="border-b border-border/40 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldIcon className="h-4 w-4 text-muted-foreground" />
          Acceso y seguridad
        </CardTitle>
      </CardHeader>

      <CardContent className="px-5 py-1">
        <div>

          {/* ── Nombre de usuario ── */}
          {abierto === "usuario" ? (
            <EditorBlock
              titulo="Nombre de usuario"
              icon={<FingerprintIcon className="h-4 w-4 text-muted-foreground" />}
              guardando={guardando.usuario}
              guardarLabel="Actualizar"
              onGuardar={onGuardarUsuario}
              onCancelar={onCancelar}
            >
              <EditorField
                id="user"
                label="Usuario"
                ayuda="Usado en los registros de auditoría y para hacer login."
              >
                <Input
                  id="user"
                  value={cuenta.user}
                  onChange={(e) => onCuenta("user", e.target.value)}
                  className="font-mono"
                />
              </EditorField>

              <EditorField
                id="userPass"
                label="Confirma tu contraseña"
                requerido
                ayuda="Cambiar tu usuario cambia con qué nombre entras, así que hay que confirmar que eres tú."
              >
                <Input
                  id="userPass"
                  type="password"
                  value={cuenta.userPass}
                  onChange={(e) => onCuenta("userPass", e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </EditorField>
            </EditorBlock>
          ) : (
            <ReadRow label="Nombre de usuario" accion={botonAbrir("usuario", "Cambiar nombre de usuario")}>
              <span className="font-mono">{cuenta.user || "—"}</span>
            </ReadRow>
          )}

          {/* ── Contraseña ── */}
          {abierto === "password" ? (
            <EditorBlock
              titulo="Contraseña"
              icon={<KeyIcon className="h-4 w-4 text-muted-foreground" />}
              guardando={guardando.password}
              guardarLabel="Cambiar clave"
              onGuardar={onGuardarPassword}
              onCancelar={onCancelar}
              pie="Se guarda cifrada con Bcrypt: nadie de Osefi puede leerla."
            >
              <EditorField id="oldPass" label="Contraseña actual" requerido>
                <Input
                  id="oldPass"
                  type="password"
                  value={cuenta.oldPass}
                  onChange={(e) => onCuenta("oldPass", e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </EditorField>

              <EditorField
                id="pass"
                label="Nueva contraseña"
                ayuda={`Al menos ${PASSWORD_MIN_LENGTH} caracteres.`}
              >
                <Input
                  id="pass"
                  type="password"
                  value={cuenta.pass}
                  onChange={(e) => onCuenta("pass", e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </EditorField>

              <EditorField id="confirmPass" label="Confirmar nueva contraseña">
                <Input
                  id="confirmPass"
                  type="password"
                  value={cuenta.confirmPass}
                  onChange={(e) => onCuenta("confirmPass", e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </EditorField>
            </EditorBlock>
          ) : (
            <ReadRow label="Contraseña" accion={botonAbrir("password", "Cambiar contraseña")}>
              <span className="font-mono tracking-widest text-muted-foreground">••••••••••</span>
            </ReadRow>
          )}

          {/* ── Correo de recuperación ── */}
          {abierto === "email" ? (
            <EditorBlock
              titulo="Correo de recuperación"
              icon={<MailIcon className="h-4 w-4 text-muted-foreground" />}
              guardando={guardando.email}
              guardarLabel={emailButtonLabel}
              onGuardar={onGuardarEmail}
              onCancelar={onCancelar}
            >
              <EditorField
                id="email"
                label="Dirección de correo"
                ayuda="Sirve para recuperar tu cuenta si olvidas la contraseña y, una vez verificado, es también tu segundo factor: podrás entrar con un código enviado aquí."
              >
                <Input
                  id="email"
                  type="email"
                  value={emailForm.email}
                  onChange={(e) => onEmailForm("email", e.target.value)}
                  placeholder="tu.correo@ejemplo.com"
                />
              </EditorField>

              <EditorField
                id="emailPass"
                label="Confirma con tu contraseña"
                requerido
                ayuda="Registrar o cambiar tu correo de recuperación exige confirmar que eres tú."
              >
                <Input
                  id="emailPass"
                  type="password"
                  value={emailForm.pass}
                  onChange={(e) => onEmailForm("pass", e.target.value)}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </EditorField>
            </EditorBlock>
          ) : (
            <ReadRow
              label="Correo de recuperación"
              accion={botonAbrir("email", "Cambiar correo de recuperación")}
            >
              {/*
                Three states, three unmistakably different badges — colour and
                wording both — because a saved-but-unverified address is
                exactly as useless as none at all: `/password/forgot` only ever
                acts on a verified one.
              */}
              {!recovery.email ? (
                <Badge variant="outline" className="text-muted-foreground font-normal">
                  Sin configurar
                </Badge>
              ) : (
                <>
                  <span className="font-mono truncate">{recovery.email}</span>
                  {emailVerificado ? (
                    <Badge className="bg-green-500/10 text-green-600 border-green-500/20 shadow-none gap-1 font-normal">
                      <MailCheckIcon className="h-3 w-3" />
                      Verificado
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 shadow-none gap-1 font-normal">
                      <MailWarningIcon className="h-3 w-3" />
                      Sin verificar
                    </Badge>
                  )}
                </>
              )}
            </ReadRow>
          )}

          {/*
            Not a fourth editor — `/app/segundo-factor` is its own screen,
            built to keep working for a session `PerfilPage` itself cannot
            (see that screen's own comment on `usePerfilData` 403ing on an
            `onboarding` session). This row is only ever a door to it, so it
            carries no `abierto`/`onAbrir` state of its own.

            A plain `<a>`, not `<Link>`: `PerfilPage.test.tsx` renders this
            tree with no `<Router>` around it, and `react-router-dom`'s
            `Link` throws the moment it mounts outside one — measured, it
            took 22 of that file's 24 tests down. Both routes live under the
            same `BrowserRouter` in the real app regardless, so this only
            costs a full navigation instead of a client-side one, for a
            settings link nobody clicks often.
          */}
          <ReadRow
            label="Segundo factor"
            accion={
              <Button variant="outline" size="sm" asChild>
                {/* Not bare "Configurar" — `PerfilPage.tsx` and `PerfilPanel.tsx`
                    both already use that exact word for the recovery email,
                    and three buttons with the same accessible name on one
                    page is a trap for anybody using a screen reader, not
                    only for a future `getByRole` query. */}
                <a href="/app/segundo-factor">Configurar segundo factor</a>
              </Button>
            }
          >
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <SmartphoneIcon className="h-3.5 w-3.5" />
              Aplicación de autenticación y códigos de recuperación
            </span>
          </ReadRow>

        </div>
      </CardContent>
    </Card>
  );
}
