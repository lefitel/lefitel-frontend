import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArchiveIcon, ArchiveRestoreIcon, Loader2Icon, PencilIcon, PlusIcon, ShieldIcon } from "lucide-react";
import { SesionContext } from "../context/SesionContext";
import { can } from "../lib/permissions";
import { getRol, createRol, editRol, archiveRol, desarchivarRol } from "../api/Rol.api";
import type { RolInterface } from "../interfaces/interfaces";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "./ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "./ui/alert-dialog";

/**
 * Creating, renaming and archiving roles.
 *
 * The server has always been able to do all three — `POST /api/rol` even seeds
 * the new role's forty denied cells so it arrives editable — but nothing in the
 * interface called any of it. `Rol.api.ts` exposed exactly one function, `getRol`,
 * so a role could only be created with a hand-made request, and in practice
 * never was.
 *
 * Archiving is the part worth reading twice. `usuarios.id_rol` is ON DELETE
 * CASCADE and `rols` had no soft delete, so `DELETE /api/rol/:id` was a real
 * DELETE that took the accounts holding the role — and every field inspection
 * any of them had recorded — with it. The chain was measured at six users and
 * 4.835 revisions. Nothing was ever lost to it only because no screen called it,
 * which is exactly what this component changes, so the server side was closed
 * first: the model is paranoid now, and the endpoint refuses outright while any
 * account still holds the role. The refusal comes back with the count, and this
 * screen shows the server's own sentence rather than inventing one.
 */
export default function RolesPanel({ onChange }: { onChange?: () => void }) {
  const { sesion } = useContext(SesionContext);
  const rolPropio = sesion.usuario.id_rol;
  const puedeCrear = can(rolPropio, "roles", "crear");
  const puedeEditar = can(rolPropio, "roles", "editar");
  const puedeArchivar = can(rolPropio, "roles", "archivar");

  const [tab, setTab] = useState<"activos" | "archivados">("activos");
  const [roles, setRoles] = useState<RolInterface[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editando, setEditando] = useState<RolInterface | null>(null);
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorNombre, setErrorNombre] = useState("");

  const [aArchivar, setAArchivar] = useState<RolInterface | null>(null);
  const [archivando, setArchivando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await getRol(tab === "archivados"));
    } catch {
      setRoles(null);
      toast.error("No se pudieron cargar los roles");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setDescripcion("");
    setErrorNombre("");
    setSheetOpen(true);
  }

  function abrirEdicion(rol: RolInterface) {
    setEditando(rol);
    setNombre(rol.name ?? "");
    setDescripcion(rol.description ?? "");
    setErrorNombre("");
    setSheetOpen(true);
  }

  async function guardar() {
    if (!nombre.trim()) { setErrorNombre("El nombre es requerido"); return; }
    setGuardando(true);
    try {
      const datos = { ...(editando ?? {}), name: nombre.trim(), description: descripcion.trim() } as RolInterface;
      const status = editando ? await editRol(datos) : await createRol(datos);
      if (status !== 200) {
        toast.error(editando ? "No se pudo guardar el rol" : "No se pudo crear el rol");
        return;
      }
      toast.success(editando ? "Rol actualizado" : "Rol creado, sin ningún permiso todavía");
      setSheetOpen(false);
      await load();
      onChange?.();
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarArchivar() {
    if (!aArchivar?.id) return;
    setArchivando(true);
    try {
      const r = await archiveRol(aArchivar.id);
      if (r.status !== 200) {
        // The server's own sentence, which carries the number of accounts still
        // holding the role. Replacing it with "no se pudo" here would throw away
        // the only thing that tells the administrator what to do next.
        toast.error(r.message ?? "No se pudo archivar el rol");
        return;
      }
      toast.success("Rol archivado");
      setAArchivar(null);
      await load();
      onChange?.();
    } finally {
      setArchivando(false);
    }
  }

  async function restaurar(rol: RolInterface) {
    if (!rol.id) return;
    const status = await desarchivarRol(rol.id);
    if (status !== 200) { toast.error("No se pudo desarchivar el rol"); return; }
    toast.success("Rol restaurado");
    await load();
    onChange?.();
  }

  const archivados = tab === "archivados";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Roles</h3>
          <p className="text-xs text-muted-foreground">
            Un rol nuevo nace sin ningún permiso. Se los das abajo, en la matriz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="h-8">
              <TabsTrigger value="activos" className="text-xs h-7">Activos</TabsTrigger>
              <TabsTrigger value="archivados" className="text-xs h-7">Archivados</TabsTrigger>
            </TabsList>
          </Tabs>
          {puedeCrear && !archivados && (
            <Button size="sm" className="h-8 gap-1.5" onClick={abrirNuevo}>
              <PlusIcon className="h-3.5 w-3.5" />
              Nuevo rol
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : !roles || roles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {archivados ? "No hay roles archivados." : "No hay roles."}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {roles.map((rol) => (
            <li key={rol.id} className="flex items-center gap-3 px-4 py-3">
              <div className="rounded-full bg-muted p-2 shrink-0">
                <ShieldIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {rol.name}
                  {rol.id === rolPropio && (
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground align-middle">
                      el tuyo
                    </span>
                  )}
                </p>
                {rol.description && (
                  <p className="text-xs text-muted-foreground truncate">{rol.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!archivados && puedeEditar && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => abrirEdicion(rol)}>
                    <PencilIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                )}
                {!archivados && puedeArchivar && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => setAArchivar(rol)}>
                    <ArchiveIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Archivar</span>
                  </Button>
                )}
                {archivados && puedeArchivar && (
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => void restaurar(rol)}>
                    <ArchiveRestoreIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <SheetTitle>{editando ? "Editar rol" : "Nuevo rol"}</SheetTitle>
            <SheetDescription>
              {editando
                ? "Cambiar el nombre no cambia lo que puede hacer: eso se edita en la matriz."
                : "Se crea sin ningún permiso. Después se los concedes en la matriz de abajo."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div className="space-y-1.5">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input
                value={nombre}
                className={errorNombre ? "border-destructive" : undefined}
                placeholder="Supervisor de campo"
                onChange={(e) => { setNombre(e.target.value); if (errorNombre) setErrorNombre(""); }}
              />
              {errorNombre && <p className="text-xs text-destructive">{errorNombre}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Input
                value={descripcion}
                placeholder="Qué hace esta persona en el sistema"
                onChange={(e) => setDescripcion(e.target.value)}
              />
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border/40">
            <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={() => void guardar()} disabled={guardando}>
              {guardando
                ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</>
                : editando ? "Guardar cambios" : "Crear rol"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={aArchivar !== null} onOpenChange={(o) => !o && setAArchivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar «{aArchivar?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de la lista y no se le podrá asignar a nadie, pero no se borra:
              puedes restaurarlo desde la pestaña de archivados. Si alguna cuenta todavía
              tiene este rol, el sistema no dejará archivarlo y te dirá cuántas son.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmarArchivar(); }} disabled={archivando}>
              {archivando ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
