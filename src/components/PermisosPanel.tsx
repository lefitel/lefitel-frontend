import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCwIcon, ShieldAlertIcon } from "lucide-react";
import { SesionContext } from "../context/SesionContext";
import { can, type Accion, type Modulo } from "../lib/permissions";
import { getMatrizPermisos, savePermisos, type MatrizPermisos } from "../api/Permisos.api";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

/** A cell the person has changed and not yet saved. */
type Pending = Record<string, boolean>;

const key = (modulo: Modulo, accion: Accion) => `${modulo}.${accion}`;

/**
 * Who may do what, as a grid of checkboxes.
 *
 * The rows and columns come from the server rather than from a list kept here:
 * the day a module is added to the system it appears in this screen without
 * anybody remembering to add it, which is the whole point of moving the matrix
 * out of the code.
 */
export default function PermisosPanel() {
  const { sesion } = useContext(SesionContext);
  const [matriz, setMatriz] = useState<MatrizPermisos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rolActivo, setRolActivo] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>({});

  const puedeEditar = can(sesion.usuario.id_rol, "roles", "editar");
  // Changing your own role's permissions is refused by the server: unticking
  // your own access to this screen would lock it for everybody. Said here too so
  // the boxes are visibly disabled rather than failing on save.
  const esPropioRol = rolActivo === sesion.usuario.id_rol;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMatrizPermisos();
      setMatriz(data);
      setPending({});
      setRolActivo((actual) => actual ?? data.roles[0]?.id ?? null);
    } catch {
      toast.error("No se pudieron cargar los permisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** The value a box should show: what is pending if anything, else what is saved. */
  const valueOf = useCallback(
    (modulo: Modulo, accion: Accion): boolean => {
      const k = key(modulo, accion);
      if (k in pending) return pending[k];
      if (rolActivo === null) return false;
      return matriz?.permisos[rolActivo]?.[modulo]?.[accion] ?? false;
    },
    [matriz, pending, rolActivo],
  );

  const toggle = (modulo: Modulo, accion: Accion, value: boolean) => {
    const k = key(modulo, accion);
    const saved = rolActivo === null ? false : matriz?.permisos[rolActivo]?.[modulo]?.[accion] ?? false;
    setPending((prev) => {
      const next = { ...prev };
      // Ticking a box back to where it started is not a change; dropping it keeps
      // the save small and the "sin guardar" count honest.
      if (value === saved) delete next[k];
      else next[k] = value;
      return next;
    });
  };

  const cambios = Object.keys(pending).length;

  const save = async () => {
    if (rolActivo === null || cambios === 0) return;
    setSaving(true);

    const payload: Partial<Record<Modulo, Partial<Record<Accion, boolean>>>> = {};
    for (const [k, value] of Object.entries(pending)) {
      const [modulo, accion] = k.split(".") as [Modulo, Accion];
      (payload[modulo] ??= {})[accion] = value;
    }

    const result = await savePermisos(rolActivo, payload);
    setSaving(false);

    if (result.status === 200) {
      toast.success(`${cambios} permiso${cambios === 1 ? "" : "s"} guardado${cambios === 1 ? "" : "s"}`);
      await load();
    } else {
      toast.error(result.message ?? "No se pudo guardar.");
    }
  };

  const rolNombre = useMemo(
    () => matriz?.roles.find((r) => r.id === rolActivo)?.name ?? "",
    [matriz, rolActivo],
  );

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!matriz || matriz.roles.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay roles configurados.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          value={String(rolActivo)}
          onValueChange={(v) => {
            if (cambios > 0) {
              toast.warning("Guarda o descarta los cambios antes de cambiar de rol.");
              return;
            }
            setRolActivo(Number(v));
          }}
        >
          <TabsList>
            {matriz.roles.map((rol) => (
              <TabsTrigger key={rol.id} value={String(rol.id)}>
                {rol.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {cambios > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                {cambios} sin guardar
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPending({})} disabled={saving}>
                Descartar
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => void save()} disabled={cambios === 0 || saving}>
            {saving ? <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
          </Button>
        </div>
      </div>

      {esPropioRol && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <ShieldAlertIcon className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <p className="text-muted-foreground">
            Estos son los permisos de tu propio rol ({rolNombre}) y no puedes cambiarlos. Si te
            quitaras el acceso a esta pantalla nadie podría devolvértelo. Pídeselo a otro
            administrador.
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
              <TableHead className="w-[240px]">Módulo</TableHead>
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
                <TableCell className="font-medium">{modulo.label}</TableCell>
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
                          disabled={!puedeEditar || esPropioRol || saving}
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
