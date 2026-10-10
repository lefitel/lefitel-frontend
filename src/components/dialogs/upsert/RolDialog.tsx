import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { createRol, editRol } from "../../../api/Rol.api";
import { getMatrizPermisos, savePermisos, type MatrizPermisos } from "../../../api/Permisos.api";
import { mensajeDeError } from "../../../api/descarga";
import type { RolInterface } from "../../../interfaces/interfaces";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Skeleton } from "../../ui/skeleton";
import { Textarea } from "../../ui/textarea";
import FormDialog from "../FormDialog";
import PermisosPanel from "../../PermisosPanel";
import {
  cambiosDePermisos, conPermisosAplicados, nombreDeRol, type PermisosPendientes as Pending,
} from "../../../lib/roles";

interface Props {
  /** The role being edited, or `null` for a new one. */
  rol: RolInterface | null;
  open: boolean;
  onClose: () => void;
  /** Something was written, and the list behind should be read again. */
  onSaved: () => void;
}

/**
 * The grid needs a role to read the boxes of, and a role not yet created has no
 * number. No real role has this one, so its row in the matrix is empty and every
 * box starts unticked — which is exactly what a new role is.
 */
const ROL_SIN_CREAR = 0;

/**
 * A role: what it is called, and what it may do. The same form makes one and
 * changes one.
 *
 * **One button, up to two requests.** The name and description are one resource
 * and the permissions another, so a save that touches both is two calls, and
 * the second can fail after the first went through. What keeps that honest:
 *
 * - Only what changed is sent. Most saves are one request, and those cannot
 *   land half done.
 * - **Editing, the permissions go first.** That route asks for the password on
 *   every attempt, so it is the one that gets cancelled, mistyped or run out of
 *   tries. First means the everyday cancellation finds nothing written, the
 *   form still open on everything typed, and Guardar retrying the whole save.
 * - **Creating, the role has to go first** — its permissions need its number.
 *   So if they are then refused, the role exists and has none, and the form
 *   says so in those words and becomes the form of that role: still open, the
 *   boxes still ticked, and Guardar now sending only them. Closing it at that
 *   point reloads the list behind, because there is a new role in it.
 * - Whichever half fails, the notice names the half that was saved. The boxes
 *   that went through stop being pending the moment the server says so — on
 *   the strength of that answer and of nothing else — so a retry does not ask
 *   for the password a second time for nothing.
 */
export default function RolDialog({ rol, open, onClose, onSaved }: Props) {
  const { sesion } = useContext(SesionContext);
  const puedeEditar = can(sesion.usuario.id_rol, "roles", "editar");

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [errorNombre, setErrorNombre] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [matriz, setMatriz] = useState<MatrizPermisos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [pending, setPending] = useState<Pending>({});
  /** The role this form made, once it has: from then on it is editing it. */
  const [creado, setCreado] = useState<RolInterface | null>(null);

  // The grid is for whoever may tick it or is reading an existing role. Somebody
  // who may create roles and not edit them gets a name and a description: the
  // server would refuse the boxes, so they are not put in front of them.
  const conPermisos = rol !== null || puedeEditar;

  /**
   * Which opening this is: the role it was opened on, and whether it is open.
   *
   * The form starts over when it opens, or when it is handed another role
   * while open — and it starts over **in this render**, not in an effect after
   * it. An effect let one frame through with the previous role's name and
   * boxes under the new role's title.
   *
   * Closing changes nothing but `open`, and the role is kept. The parent
   * forgets the role the instant it closes the form, and the dialog stays on
   * screen for the length of its exit animation: reading `rol` during those
   * frames turned every closing edit into a "Nuevo rol" form shrinking away.
   */
  const [apertura, setApertura] = useState<{ open: boolean; rol: RolInterface | null }>({ open: false, rol: null });
  if (open && (!apertura.open || apertura.rol !== rol)) {
    setApertura({ open: true, rol });
    setNombre(rol?.name ?? "");
    setDescripcion(rol?.description ?? "");
    setErrorNombre("");
    setPending({});
    setMatriz(null);
    setCreado(null);
    setCargando(conPermisos);
  } else if (!open && apertura.open) {
    setApertura({ open: false, rol: apertura.rol });
  }
  const actual = creado ?? (open ? rol : apertura.rol);
  const existe = actual !== null;
  const rolId = actual?.id ?? ROL_SIN_CREAR;
  // Somebody who may only look gets the form with nothing to press. Creating
  // is its own permission, and the screen does not open this without it.
  const soloLectura = existe && !puedeEditar;

  /**
   * The grid: which modules there are, which actions, and what this role holds.
   *
   * An answer is only taken if it is still the one being waited for. Without
   * that, a slow answer from a previous opening landed on this one — and in
   * development, where every effect runs twice, the second answer of the same
   * opening did. Either way the person had ticked boxes by then.
   *
   * It never touches what is pending. Loading is not a reason to forget what
   * somebody ticked; opening the form is, and that happens above.
   */
  useEffect(() => {
    if (!open || !conPermisos) return;
    let vigente = true;
    getMatrizPermisos()
      .then((respuesta) => { if (vigente) setMatriz(respuesta); })
      .catch((error) => {
        if (!vigente) return;
        setMatriz(null);
        toast.error(mensajeDeError(error, "No se pudieron cargar los permisos."));
      })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, [open, rol, conPermisos]);

  const cambios = Object.keys(pending).length;
  const cambianDatos =
    nombre.trim() !== (actual?.name ?? "").trim() || descripcion.trim() !== (actual?.description ?? "").trim();

  /** Every way out. A role made here is in the list now, so the list is read again. */
  const cerrar = () => (creado ? onSaved() : onClose());

  async function guardar() {
    if (!nombre.trim()) { setErrorNombre("El nombre es requerido"); return; }
    const datos = { name: nombre.trim(), description: descripcion.trim() };

    setGuardando(true);
    try {
      let destino = actual;
      // Set once the role was made by this very press, so the notices below
      // can say what happened in it and not what happened in an earlier one.
      let recienCreado = false;
      if (!destino) {
        try {
          destino = await createRol(datos);
        } catch (error) {
          toast.error(mensajeDeError(error, "No se pudo crear el rol"));
          return;
        }
        recienCreado = true;
        setCreado(destino);
      } else if (cambios === 0 && !cambianDatos) {
        cerrar();
        return;
      }

      // Set after the permissions actually went through, not from `cambios`:
      // the sentence below claims something was saved, and may only be said
      // on the path where it was.
      let permisosGuardados = false;
      if (cambios > 0) {
        const resultado = await savePermisos(destino.id as number, cambiosDePermisos(pending));
        // Either of the two a write answers with here. Only 200 today; 204 is
        // what this codebase's own standard gives a write with nothing to say,
        // and a route brought into line must not read as a failure — the name
        // would then never be sent, after the boxes were saved.
        const guardado = resultado.status === 200 || resultado.status === 204;
        if (!guardado) {
          const motivo = resultado.message ?? "No se pudieron guardar los permisos.";
          toast.error(recienCreado ? `El rol se creó, pero sin permisos todavía. ${motivo}` : motivo);
          return;
        }
        permisosGuardados = true;
        // Saved, so no longer something to lose or to send again. Folded into
        // what is on screen rather than read back: a read can fail, and then
        // the boxes would still count as pending over a grid that is not
        // there — re-sent on the retry, behind another password prompt.
        const guardados = pending;
        setMatriz((vigente) => vigente && conPermisosAplicados(vigente, destino!.id as number, guardados));
        setPending({});
      }

      if (!recienCreado && cambianDatos) {
        try {
          await editRol({ ...destino, ...datos });
        } catch (error) {
          const motivo = mensajeDeError(error, "No se pudo guardar el rol");
          toast.error(permisosGuardados
            ? `Los permisos sí se guardaron; el nombre y la descripción no. ${motivo}`
            : motivo);
          return;
        }
      }

      toast.success(
        !recienCreado ? "Rol actualizado"
        : permisosGuardados ? "Rol creado"
        // Said out loud: a role with nothing ticked can do nothing, and an
        // administrator who does not know that files a bug about the account.
        : "Rol creado, sin ningún permiso todavía",
      );
      onSaved();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <FormDialog
      open={open}
      onClose={cerrar}
      size={conPermisos ? "lg" : "sm"}
      title={existe ? nombreDeRol(actual) : "Nuevo rol"}
      description={existe
        ? "Cómo se llama este rol y lo que puede hacer quien lo tiene."
        : puedeEditar
          ? "Ponle nombre y marca lo que puede hacer. Sin ninguna casilla marcada no puede hacer nada."
          // Said only to somebody it is true for: handing out permissions is a
          // different permission from creating roles.
          : "Se crea sin ningún permiso. Concedérselos necesita el permiso de editar roles."}
      dirty={!soloLectura && (cambianDatos || cambios > 0)}
      missing={nombre.trim() ? [] : ["Nombre"]}
      saving={guardando}
      submitLabel={existe ? "Guardar cambios" : "Crear rol"}
      onSubmit={soloLectura ? undefined : () => void guardar()}
      bodyClassName="space-y-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="rol-nombre">Nombre <span className="text-destructive">*</span></Label>
        {/* `readOnly`, not `disabled`, for somebody who may only look: a
            disabled field leaves the tab order, and reading it is the one
            thing they came to do. */}
        <Input
          id="rol-nombre"
          value={nombre}
          readOnly={soloLectura}
          disabled={guardando}
          required
          aria-required
          aria-invalid={!!errorNombre}
          aria-describedby={errorNombre ? "rol-nombre-error" : undefined}
          placeholder="Supervisor de campo"
          onChange={(e) => { setNombre(e.target.value); if (errorNombre) setErrorNombre(""); }}
        />
        {errorNombre && <p id="rol-nombre-error" className="text-xs text-destructive">{errorNombre}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rol-descripcion">Descripción</Label>
        <Textarea
          id="rol-descripcion"
          className="resize-none min-h-20"
          value={descripcion}
          readOnly={soloLectura}
          disabled={guardando}
          placeholder="Qué hace esta persona en el sistema"
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </div>

      {conPermisos && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-medium">Permisos</h3>
            {cambios > 0 && (
              <span className="text-xs text-muted-foreground">
                {cambios === 1 ? "1 casilla cambiada" : `${cambios} casillas cambiadas`}
              </span>
            )}
          </div>
          {cargando && !matriz
            ? <Skeleton className="h-64 w-full" />
            : matriz
              ? (
                <PermisosPanel
                  matriz={matriz}
                  rolId={rolId}
                  pending={pending}
                  onPendingChange={setPending}
                  disabled={guardando}
                />
              )
              : <p className="text-sm text-muted-foreground">No se pudieron cargar los permisos.</p>}
        </div>
      )}
    </FormDialog>
  );
}
