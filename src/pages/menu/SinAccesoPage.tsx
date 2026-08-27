import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { LockKeyholeIcon, UserRoundIcon } from "lucide-react";
import { SesionContext } from "../../context/SesionContext";
import { Button } from "../../components/ui/button";

/**
 * What an account with no modules sees.
 *
 * Until now it saw the dashboard, because `/app/home` belongs to no module and
 * is where every redirect lands — and the dashboard asked the server for
 * nothing it had to be allowed to have. Since it started asking for
 * `eventos.ver`, that same account gets a refusal, and the screen reported it as
 * "no hay conexión con el servidor": a network problem, for a permissions
 * problem, sending whoever reads it to check a network that is fine.
 *
 * A role created from Seguridad starts with all thirty-two cells denied, so this is
 * not an edge case — it is the first thing every new role sees before anybody
 * grants it anything, and the sentence it reads decides whether the next call is
 * to an administrator or to whoever maintains the servers.
 *
 * The account's username is on screen deliberately: the administrator's first
 * question is always which account, and the person looking at this cannot open
 * any screen that would tell them.
 */
export default function SinAccesoPage() {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-20 text-center">
      <div className="rounded-full bg-muted p-4">
        <LockKeyholeIcon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">Tu cuenta todavía no tiene acceso</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          El rol asignado a tu cuenta no tiene ningún módulo habilitado, así que no hay
          ninguna pantalla que puedas abrir. No es un fallo del sistema ni de tu conexión:
          falta que un administrador te conceda permisos.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card px-4 py-3 text-left">
        <p className="text-xs text-muted-foreground mb-0.5">Dile a quien administre el sistema que esta es tu cuenta:</p>
        <p className="flex items-center gap-2 text-sm font-medium">
          <UserRoundIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span>{sesion.usuario.user}</span>
          <span className="text-muted-foreground font-normal">
            · {`${sesion.usuario.name} ${sesion.usuario.lastname}`.trim()}
          </span>
        </p>
      </div>

      <Button variant="outline" onClick={() => navigate("/app/perfil")}>
        Ver mi perfil
      </Button>
    </div>
  );
}
