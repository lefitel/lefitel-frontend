import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailCheckIcon, MailWarningIcon, ShieldIcon } from "lucide-react";
import { ReadRow } from "./perfilRows";
import PasskeysSection from "../segundoFactor/PasskeysSection";
import TotpSection from "../segundoFactor/TotpSection";
import RecoveryCodesSection from "../segundoFactor/RecoveryCodesSection";
import { FILA_SIN_PANEL } from "../segundoFactor/filaDePerfil";

/** The three credentials of this card that open a dialog of the page's. */
export type CredencialAcceso = "usuario" | "password" | "correo";

interface Props {
  /** The account's name. */
  usuario: string;
  recovery: { email: string | null; verifiedAt: string | null };
  onAbrir: (cual: CredencialAcceso) => void;
  /** How many passkeys and how many unspent codes there are, for the summary panel. */
  onLlaves: (llaves: number | null) => void;
  onCodigos: (codigos: number | null) => void;
  /** A counter the summary panel moves to open the codes confirmation here. */
  pedirCodigos: number;
}

/**
 * The three credentials, each opening its own dialog — and, since October 2026,
 * the passkeys, the authenticator app and the recovery codes beside them.
 *
 * Read-only: what is typed lives in the page's dialogs, and what the
 * second-factor rows type lives in theirs. The only state here is whether the
 * passkeys panel is unfolded, because it is the one row that has a list to show.
 *
 * **The second-factor rows ask for no password.** Passkeys, the authenticator
 * app and the recovery codes did, each in a form of its own, while their routes
 * demanded it on every request. Since 2026-10-10 every gated route takes the
 * ten-minute window (Isaias), so they too leave the asking to the step-up
 * dialog.
 *
 * **Those three used to live on a screen of their own, behind a link in this
 * card**, and Isaias asked for them here: a setting one click away on another
 * page is a setting nobody finds. They are the same sections
 * `/app/segundo-factor` draws as cards, handed a `fila` so they draw as rows.
 * That screen stays for the one session that cannot load this one —
 * `onboarding`, see its own header.
 *
 * **The passkey sits under the password, not under the heading below it**,
 * because that is what it is to the person holding it: a way to get in. The
 * heading says the other half out loud — a registered key also makes a
 * password login ask for a second step — so that nobody finds it out at the
 * login screen.
 *
 * **Button names are load-bearing.** The buttons that open a dialog are named
 * by `aria-label`, not by their visible "Cambiar": three buttons all reading
 * "Cambiar" would be ambiguous to a test and useless to a screen reader alike.
 */
export default function PerfilAcceso({
  usuario, recovery, onAbrir, onLlaves, onCodigos, pedirCodigos,
}: Props) {
  const emailVerificado = recovery.verifiedAt !== null;

  const [llavesAbiertas, setLlavesAbiertas] = useState(false);
  const filaLlaves = {
    panel: {
      abierto: llavesAbiertas,
      onAbrir: () => setLlavesAbiertas(true),
      onCerrar: () => setLlavesAbiertas(false),
    },
  };

  // Registering a first key or a first app makes the server mint ten recovery
  // codes, and the codes row only counts them when it mounts. Without this it
  // would go on saying "Sin códigos disponibles" beside the sheet the person
  // has just been shown.
  const [tandaCodigos, setTandaCodigos] = useState(0);
  const codigosEmitidos = () => setTandaCodigos((n) => n + 1);

  const botonAbrir = (cual: CredencialAcceso, etiqueta: string, texto = "Cambiar") => (
    <Button variant="outline" size="sm" aria-label={etiqueta} onClick={() => onAbrir(cual)}>
      {texto}
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
          <ReadRow label="Nombre de usuario" accion={botonAbrir("usuario", "Cambiar nombre de usuario")}>
            <span className="font-mono">{usuario || "—"}</span>
          </ReadRow>

          <ReadRow label="Contraseña" accion={botonAbrir("password", "Cambiar contraseña")}>
            <span className="font-mono tracking-widest text-muted-foreground">••••••••••</span>
          </ReadRow>

          <PasskeysSection fila={filaLlaves} onCodigosEmitidos={codigosEmitidos} onRecuento={onLlaves} />

          <ReadRow
            label="Correo de recuperación"
            accion={
              recovery.email
                ? botonAbrir("correo", "Cambiar correo de recuperación")
                : botonAbrir("correo", "Añadir correo de recuperación", "Añadir")
            }
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

          <div className="pt-5 pb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verificación en dos pasos
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Lo que se te pide además de la contraseña. Una llave de acceso o un correo verificado
              también la activan: al entrar con contraseña se te pedirá un segundo paso.
            </p>
          </div>

          <TotpSection fila={FILA_SIN_PANEL} onCodigosEmitidos={codigosEmitidos} />
          <RecoveryCodesSection
            key={tandaCodigos}
            fila={FILA_SIN_PANEL}
            onRecuento={onCodigos}
            pedirGenerar={pedirCodigos}
          />
        </div>
      </CardContent>
    </Card>
  );
}
