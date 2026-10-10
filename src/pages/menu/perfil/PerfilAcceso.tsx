import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FingerprintIcon, KeyIcon, MailCheckIcon, MailIcon, MailWarningIcon, ShieldIcon,
} from "lucide-react";
import { ReadRow, EditorBlock, EditorField } from "./perfilRows";
import { PASSWORD_MIN_LENGTH } from "../../../lib/password";
import PasskeysSection from "../segundoFactor/PasskeysSection";
import TotpSection from "../segundoFactor/TotpSection";
import RecoveryCodesSection from "../segundoFactor/RecoveryCodesSection";

/** The three rows that are second-factor sections rather than editors of this card's own. */
export type EditorFactor = "llave" | "totp" | "codigos";

export type EditorAcceso = "usuario" | "password" | "email" | EditorFactor;

export interface DatosCuenta {
  user: string;
  /**
   * The current password, for the password editor alone.
   *
   * There used to be a second one beside it, `userPass`, carried by the rename
   * — and keeping the two apart was a rule this file spent a paragraph on.
   * Both the field and the rule are gone: renaming proves identity at the
   * step-up gate now, so it collects nothing. This one stays because on a
   * password change the current password is not a confirmation at all, it is
   * half of what is being changed.
   */
  oldPass: string;
  pass: string;
  confirmPass: string;
}

interface Props {
  cuenta: DatosCuenta;
  emailForm: { email: string };
  recovery: { email: string | null; verifiedAt: string | null };
  /** Which row is open, or null when all of them are being read. */
  abierto: EditorAcceso | null;
  guardando: { usuario: boolean; password: boolean; email: boolean };
  onCuenta: (campo: keyof DatosCuenta, valor: string) => void;
  onEmailForm: (campo: "email", valor: string) => void;
  onAbrir: (cual: EditorAcceso) => void;
  onCancelar: () => void;
  onGuardarUsuario: () => void;
  onGuardarPassword: () => void;
  onGuardarEmail: () => void;
}

/**
 * The three credentials, each opening on its own — and, since October 2026,
 * the passkeys, the authenticator app and the recovery codes beside them.
 *
 * These used to be three separate cards, each with its own "confirm your
 * password" box — three password fields on one screen with no explanation of
 * why there were three. They are one card now, and only one of them is ever
 * open, so the question "which password box am I in" cannot be asked.
 *
 * 🔴 **And the three editors share one password box, not three.** The rename
 * and the recovery address stopped collecting one when the demand moved to the
 * step-up gate: it asks once, through a dialog that says what it is protecting,
 * and then stops asking for ten minutes. A box here as well meant typing the
 * same secret twice for one operation, which is the complaint this whole piece
 * of work answers. `Contraseña actual` on the password editor is not a
 * confirmation of identity and so it stays — there, the current password is
 * half of what is being changed.
 *
 * **The second-factor rows ask for no password either.** Passkeys, the
 * authenticator app and the recovery codes did, each in a form of its own,
 * while their routes demanded it on every request. Since 2026-10-10 every
 * gated route takes the ten-minute window (Isaias), so they too leave the
 * asking to the step-up dialog.
 *
 * **Those three used to live on a screen of their own, behind a link in this
 * card**, and Isaias asked for them here: a setting one click away on another
 * page is a setting nobody finds. They are the same sections
 * `/app/segundo-factor` draws as cards, handed a `fila` so they draw as rows
 * that open in place. That screen stays for the one session that cannot load
 * this one — `onboarding`, see its own header. A row opens to show what the
 * account has; everything typed happens in a dialog, which is why these rows
 * need nothing from `PerfilPage`'s dirty check.
 *
 * **The passkey sits under the password, not under the heading below it**,
 * because that is what it is to the person holding it: a way to get in. The
 * heading says the other half out loud — a registered key also makes a
 * password login ask for a second step — so that nobody finds it out at the
 * login screen.
 *
 * **Every label and button name here is load-bearing.** `PerfilPage.test.tsx`
 * reaches these fields with `getByLabelText` and these buttons with
 * `getByRole("button", { name })`, both of which throw on an ambiguous match
 * rather than picking one. The rules that keeps:
 *
 * - 🔴 **No `<input>` inside the username editor or the recovery-address
 *   editor may be labelled with the word "contraseña".** That is the rule, and
 *   it is narrower than "this card has one password label": the password
 *   editor alone holds three of them (`Contraseña actual`, `Nueva
 *   contraseña`, `Confirmar nueva contraseña`), and the collapsed row and its
 *   `aria-label` carry the word too. Two of that screen's tests assert the
 *   **absence** with a query as loose as `/contraseña/i` scoped to
 *   `{ selector: "input" }` — scoped precisely because those other five
 *   matches exist and an unscoped query trips over the row's own button. So a
 *   new *field* worded anything like it, in either of those two editors, turns
 *   them red instead of passing under a different name.
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

  const fila = (cual: EditorFactor) => ({
    abierto: abierto === cual,
    onAbrir: () => onAbrir(cual),
    onCerrar: onCancelar,
  });

  // Registering a first key or a first app makes the server mint ten recovery
  // codes, and the codes row only counts them when it mounts. Without this it
  // would go on saying "Sin códigos disponibles" beside the sheet the person
  // has just been shown.
  const [tandaCodigos, setTandaCodigos] = useState(0);
  const codigosEmitidos = () => setTandaCodigos((n) => n + 1);

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
                ayuda="Usado en los registros de auditoría y para hacer login. Al guardar te pediremos confirmar que eres tú."
              >
                <Input
                  id="user"
                  value={cuenta.user}
                  onChange={(e) => onCuenta("user", e.target.value)}
                  className="font-mono"
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

          {/* ── Llave de acceso ── */}
          <PasskeysSection fila={fila("llave")} onCodigosEmitidos={codigosEmitidos} />

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

          {/* ── Verificación en dos pasos ── */}
          <div className="pt-5 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verificación en dos pasos
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Lo que se te pide además de la contraseña. Una llave de acceso o un correo verificado
              también la activan: al entrar con contraseña se te pedirá un segundo paso.
            </p>
          </div>

          <TotpSection fila={fila("totp")} onCodigosEmitidos={codigosEmitidos} />
          <RecoveryCodesSection key={tandaCodigos} fila={fila("codigos")} />

        </div>
      </CardContent>
    </Card>
  );
}
