import { useContext } from "react";
import { ShieldAlertIcon } from "lucide-react";
import { SesionContext } from "../context/SesionContext";
import { can, type Accion, type Modulo } from "../lib/permissions";
import type { MatrizPermisos } from "../api/Permisos.api";
import { clavePermiso as key, type PermisosPendientes as Pending } from "../lib/roles";
import { Checkbox } from "./ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { cn } from "@/lib/utils";

/** The module's column, pinned to the left below `md`, over the actions that scroll under it. */
const STICKY_MODULE = "max-md:sticky max-md:left-0 max-md:z-[1] max-md:bg-background";

interface Props {
  /** The server's answer: which modules, which actions, who holds what. */
  matriz: MatrizPermisos;
  /** The role whose permissions these are. */
  rolId: number;
  pending: Pending;
  onPendingChange: (next: Pending) => void;
  /** A save is out: nothing can be ticked until it comes back. */
  disabled?: boolean;
}

/**
 * What one role may do, as a grid of checkboxes.
 *
 * The rows and columns come from the server rather than from a list kept here:
 * the day a module is added to the system it appears in this screen without
 * anybody remembering to add it, which is the whole point of moving the matrix
 * out of the code.
 *
 * It used to load the matrix, choose the role from a row of tabs and save by
 * itself. It is one part of a role's form now, beside its name, under one
 * button — so the form holds what is loaded and what is pending, and this only
 * draws it and says what was ticked.
 */
export default function PermisosPanel({ matriz, rolId, pending, onPendingChange, disabled = false }: Props) {
  const { sesion } = useContext(SesionContext);

  const puedeEditar = can(sesion.usuario.id_rol, "roles", "editar");
  // Changing your own role's permissions is refused by the server: unticking
  // your own access to this screen would lock it for everybody. Said here too so
  // the boxes are visibly disabled rather than failing on save.
  const esPropioRol = rolId === sesion.usuario.id_rol;

  const savedOf = (modulo: Modulo, accion: Accion): boolean =>
    matriz.permisos[rolId]?.[modulo]?.[accion] ?? false;

  /** The value a box should show: what is pending if anything, else what is saved. */
  const valueOf = (modulo: Modulo, accion: Accion): boolean => {
    const k = key(modulo, accion);
    return k in pending ? pending[k] : savedOf(modulo, accion);
  };

  const toggle = (modulo: Modulo, accion: Accion, value: boolean) => {
    const k = key(modulo, accion);
    const next = { ...pending };
    // Ticking a box back to where it started is not a change; dropping it keeps
    // the save small and "is there anything to lose" honest.
    if (value === savedOf(modulo, accion)) delete next[k];
    else next[k] = value;
    onPendingChange(next);
  };

  return (
    <div className="space-y-3">
      {esPropioRol && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <ShieldAlertIcon className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <p className="text-muted-foreground">
            Estos son los permisos de tu propio rol y no puedes cambiarlos. Si te quitaras el
            acceso a esta pantalla nadie podría devolvértelo. Pídeselo a otro administrador.
          </p>
        </div>
      )}

      {!puedeEditar && !esPropioRol && (
        <p className="text-sm text-muted-foreground">
          Solo puedes consultar. Cambiar permisos necesita el módulo Roles y permisos.
        </p>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {/* On a phone the actions scroll sideways under the module's
                  name, which stays put and narrows to two lines: at 240px it
                  was most of the screen, and once scrolled the ticks no longer
                  said what they belonged to. */}
              <TableHead className={cn("w-[240px] max-md:w-32", STICKY_MODULE)}>Módulo</TableHead>
              {matriz.acciones.map((accion) => (
                <TableHead key={accion.key} className="text-center whitespace-nowrap">
                  {accion.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matriz.modulos.map((modulo) => (
              <TableRow key={modulo.key}>
                <TableCell className={cn("font-medium max-md:whitespace-normal", STICKY_MODULE)}>{modulo.label}</TableCell>
                {matriz.acciones.map((accion) => {
                  // A module only carries the actions it declares, so most rows
                  // have holes in them. A hole, and deliberately not a disabled
                  // checkbox: an empty greyed box reads as "not granted yet,
                  // somebody tick this", which is the confusion this whole
                  // change exists to remove. Nothing there says nothing to say.
                  //
                  // It also keeps the screen from offering a cell the server
                  // would refuse by name — the administrator would be told off
                  // for something this panel put in front of them.
                  // `?? true` rather than `modulo.acciones.includes(...)`: an
                  // API that predates this field sends `modulos` without it, and
                  // reading `.includes` off `undefined` throws *during render*.
                  // There is no ErrorBoundary anywhere in this app, so React
                  // unmounts the root and the whole thing goes blank — sidebar
                  // and navigation included, with nothing left to click.
                  //
                  // The design only reasoned about the other direction, an old
                  // bundle against this server, and an audit reproduced this one.
                  // It is not only a deploy-order mistake either: an API rollback
                  // with this bundle already in a browser gets there too, and no
                  // order avoids that.
                  //
                  // Falling back to "draw it" is the safe default. The worst case
                  // is the behaviour that existed before this change — a box the
                  // server refuses by name — rather than an application that
                  // disappears.
                  if (!(modulo.acciones?.includes(accion.key) ?? true)) {
                    return (
                      <TableCell key={accion.key} className="text-center">
                        {/* Not an empty cell: somebody reading the table one cell
                            at a time hears "blank" and cannot tell "does not
                            apply here" from "a checkbox failed to render". */}
                        <span className="text-muted-foreground/40" aria-label="No aplica">
                          —
                        </span>
                      </TableCell>
                    );
                  }
                  const checked = valueOf(modulo.key, accion.key);
                  const changed = key(modulo.key, accion.key) in pending;
                  return (
                    <TableCell key={accion.key} className="text-center">
                      <span
                        className={
                          changed ? "inline-flex rounded-sm ring-2 ring-primary/50 ring-offset-2 ring-offset-background" : "inline-flex"
                        }
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!puedeEditar || esPropioRol || disabled}
                          onCheckedChange={(v) => toggle(modulo.key, accion.key, v === true)}
                          aria-label={`${modulo.label}: ${accion.label}`}
                        />
                      </span>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Los cambios afectan a todas las personas con ese rol y se aplican en cuanto recargan la
        página. Cada cambio queda registrado en la bitácora.
      </p>
    </div>
  );
}
