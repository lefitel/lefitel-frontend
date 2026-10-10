import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import type { Col } from "../../components/table/tableFeatures";
import { SesionContext } from "../../context/SesionContext";
import { can } from "../../lib/permissions";
import { archiveRol, desarchivarRol, getRol } from "../../api/Rol.api";
import { getMatrizPermisos, type MatrizPermisos } from "../../api/Permisos.api";
import { mensajeDeError } from "../../api/descarga";
import type { RolInterface } from "../../interfaces/interfaces";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import DataTable from "../../components/table/DataTable";
import { rowNumberColumn } from "../../components/table/rowNumberColumn";
import RolDialog from "../../components/dialogs/upsert/RolDialog";
import { nombreDeRol, resumenDePermisos } from "../../lib/roles";

type Tab = "activos" | "archivados";

const fecha = (valor: Date | string | null | undefined) =>
  valor ? new Date(valor).toLocaleDateString("es-ES") : "—";

/**
 * The roles, and what each of them may do.
 *
 * This was a tab of the users screen. It asked for a permission of its own
 * (`roles`) from inside a screen that asks for another (`seguridad`), so both
 * were needed to reach it — and a role allowed to manage roles but not accounts
 * could not. It has its own entry in the menu and its own route now, and the
 * one permission that was always meant to open it does.
 *
 * A list like every other list here, and a role opens in a form: its name, its
 * description and its permissions, saved with one button. There used to be two
 * lists of the same roles on this screen — one to rename and archive them, and
 * a row of tabs over the grid to choose among them again.
 *
 * Archiving is the part worth reading twice. `usuarios.id_rol` is ON DELETE
 * CASCADE and `rols` had no soft delete, so `DELETE /api/rol/:id` was a real
 * DELETE that took the accounts holding the role — and every field inspection
 * any of them had recorded — with it. The model is paranoid now, and the
 * endpoint refuses outright while any account still holds the role. The refusal
 * comes back with the count, and this screen shows the server's own sentence
 * rather than inventing one. The count is also a column, so the administrator
 * sees it before pressing.
 */
export default function RolesPage() {
  const { sesion } = useContext(SesionContext);
  const rolPropio = sesion.usuario.id_rol;
  const puedeCrear = can(rolPropio, "roles", "crear");
  const puedeEditar = can(rolPropio, "roles", "editar");
  const puedeArchivar = can(rolPropio, "roles", "archivar");

  const [tab, setTab] = useState<Tab>("activos");
  const [roles, setRoles] = useState<RolInterface[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [archivados, setArchivados] = useState<RolInterface[] | null>(null);
  const [loadingArchivados, setLoadingArchivados] = useState(false);
  /**
   * Whether the archived list has to be read when its tab is next shown.
   *
   * Its own flag rather than "the list is null". A read that fails leaves the
   * list null, and an effect that reads whenever it is null answered a failed
   * refresh by reading again at once: two requests and two error notices for
   * one press.
   */
  const [archivadosPorLeer, setArchivadosPorLeer] = useState(true);

  /** The form: closed, open on a role, or open on a new one (`rol: null`). */
  const [formulario, setFormulario] = useState<{ rol: RolInterface | null } | null>(null);
  const [aArchivar, setAArchivar] = useState<RolInterface | null>(null);
  const [archivando, setArchivando] = useState(false);

  /**
   * What every role may do, for the two columns that sum it up.
   *
   * Read beside the list and allowed to fail without a word: the list is the
   * screen, and a role with dashes in two columns is still a role that can be
   * opened — where the form asks for the same thing and does say so.
   */
  const [matriz, setMatriz] = useState<MatrizPermisos | null>(null);

  const load = useCallback(async (): Promise<RolInterface[] | null> => {
    setLoading(true);
    void getMatrizPermisos().then(setMatriz).catch(() => setMatriz(null));
    try {
      const lista = await getRol();
      setRoles(lista);
      return lista;
    } catch {
      setRoles(null);
      toast.error("No se pudieron cargar los roles");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Bumped whenever the archived list is asked for again or marked stale, so an
   * answer that was already travelling can tell it is no longer the latest.
   */
  const versionArchivados = useRef(0);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  const loadArchivados = useCallback(async () => {
    versionArchivados.current += 1;
    setArchivadosPorLeer(false);
    setLoadingArchivados(true);
    try {
      setArchivados(await getRol(true));
    } catch {
      setArchivados(null);
      toast.error("No se pudieron cargar los roles archivados");
    } finally {
      setLoadingArchivados(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (tab === "archivados" && archivadosPorLeer) void loadArchivados();
  }, [tab, archivadosPorLeer, loadArchivados]);

  /**
   * `?rol=7`, which is how the Bitácora links to a role.
   *
   * Attended once, when the list is in, and then taken out of the address: left
   * there, closing the form and reloading would open it again, and so would
   * every `load()` after a save.
   *
   * A role that is not among the active ones is looked for among the archived
   * before anything is said. "No existe" about a role that is one tab away
   * would be a wrong answer about the very record the log is pointing at.
   */
  const [parametros, setParametros] = useSearchParams();
  const rolPedido = Number(parametros.get("rol")) || null;
  const pedidoAtendido = useRef(false);
  useEffect(() => {
    if (!rolPedido || roles === null || pedidoAtendido.current) return;
    pedidoAtendido.current = true;
    setParametros((actuales) => { actuales.delete("rol"); return actuales; }, { replace: true });

    const activo = roles.find((r) => r.id === rolPedido);
    if (activo) {
      setFormulario({ rol: activo });
      return;
    }
    const version = versionArchivados.current;
    getRol(true)
      .then((lista) => {
        // The screen was left while this travelled: no notice on another page.
        if (!montado.current) return;
        // A role archived in the meantime marked the archived list stale. This
        // answer predates that; keeping it would leave the tab without the role
        // just archived until somebody pressed refresh.
        if (version === versionArchivados.current) {
          setArchivados(lista);
          setArchivadosPorLeer(false);
        }
        const archivado = lista.find((r) => r.id === rolPedido);
        if (!archivado) return void toast.error(`El rol #${rolPedido} ya no existe`);
        setTab("archivados");
        toast.info(`«${nombreDeRol(archivado)}» está archivado`);
      })
      .catch(() => {
        if (montado.current) toast.error(`No se pudo comprobar si el rol #${rolPedido} está archivado`);
      });
  }, [rolPedido, roles, setParametros]);

  // The form makes a role and gives it its permissions in one go, so there is
  // nothing to open afterwards: it closes, and the list is read again.
  function alGuardar() {
    setFormulario(null);
    void load();
  }

  async function confirmarArchivar() {
    if (!aArchivar?.id) return;
    setArchivando(true);
    try {
      await archiveRol(aArchivar.id);
      toast.success("Rol archivado");
      setAArchivar(null);
      versionArchivados.current += 1;
      setArchivadosPorLeer(true); // read again the next time that tab is opened
      void load();
    } catch (error) {
      // The server's own sentence, which carries the number of accounts still
      // holding the role. Replacing it with "no se pudo" here would throw away
      // the only thing that tells the administrator what to do next.
      toast.error(mensajeDeError(error, "No se pudo archivar el rol"));
    } finally {
      setArchivando(false);
    }
  }

  async function restaurar(rol: RolInterface) {
    if (!rol.id) return;
    try {
      await desarchivarRol(rol.id);
    } catch (error) {
      toast.error(mensajeDeError(error, "No se pudo desarchivar el rol"));
      return;
    }
    toast.success("Rol restaurado");
    void loadArchivados();
    void load();
  }

  const columns = useMemo<Col<RolInterface>[]>(() => [
    rowNumberColumn(),
    {
      id: "name",
      accessorFn: (rol) => nombreDeRol(rol),
      header: "Rol",
      cell: ({ row }) => (
        <div className="min-w-0">
          <button
            className="font-medium text-sm text-primary hover:underline text-left"
            onClick={(e) => { e.stopPropagation(); setFormulario({ rol: row.original }); }}
          >
            {nombreDeRol(row.original)}
          </button>
          {row.original.id === rolPropio && (
            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground align-middle">
              el tuyo
            </span>
          )}
          {row.original.description && (
            <p className="text-xs text-muted-foreground truncate max-w-96">{row.original.description}</p>
          )}
        </div>
      ),
    },
    {
      // What the role is for, at a glance: the screens it can open.
      id: "modulos",
      accessorFn: (rol) => (matriz ? resumenDePermisos(matriz, rol.id as number).modulos.join(", ") : ""),
      header: "Puede abrir",
      enableSorting: false,
      cell: ({ row }) => {
        if (!matriz) return <span className="text-sm text-muted-foreground">—</span>;
        const { modulos } = resumenDePermisos(matriz, row.original.id as number);
        if (modulos.length === 0) return <span className="text-xs text-muted-foreground">Ningún módulo</span>;
        const visibles = modulos.slice(0, 4);
        return (
          <div className="flex flex-wrap items-center gap-1 max-w-80" title={modulos.join(", ")}>
            {visibles.map((modulo) => (
              <Badge key={modulo} variant="outline" className="text-[11px] font-normal">{modulo}</Badge>
            ))}
            {modulos.length > visibles.length && (
              <span className="text-xs text-muted-foreground">+{modulos.length - visibles.length}</span>
            )}
          </div>
        );
      },
    },
    {
      // And how much of the system that is: boxes ticked, out of all there are.
      id: "permisos",
      accessorFn: (rol) => (matriz ? resumenDePermisos(matriz, rol.id as number).concedidos : 0),
      header: "Permisos",
      enableColumnFilter: false,
      cell: ({ row }) => {
        if (!matriz) return <span className="text-sm text-muted-foreground">—</span>;
        const { concedidos, total } = resumenDePermisos(matriz, row.original.id as number);
        return (
          <span className="text-sm tabular-nums whitespace-nowrap">
            {concedidos} <span className="text-xs text-muted-foreground">de {total}</span>
          </span>
        );
      },
    },
    {
      id: "cuentas",
      accessorFn: (rol) => rol.cuentas ?? 0,
      header: "Cuentas",
      enableColumnFilter: false,
      cell: ({ row }) => {
        const { cuentas, cuentasArchivadas } = row.original;
        if (typeof cuentas !== "number") return <span className="text-sm">—</span>;
        // The archived ones are said apart: they keep the role from being
        // archived just the same, and they are not in the list of users the
        // administrator would go and look at.
        return (
          <span className="text-sm tabular-nums">
            {cuentas}
            {cuentasArchivadas ? (
              <span className="text-xs text-muted-foreground">
                {" "}({cuentasArchivadas === 1 ? "1 archivada" : `${cuentasArchivadas} archivadas`})
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Registrado",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{fecha(row.original.createdAt)}</span>
      ),
    },
    {
      accessorKey: "updatedAt",
      header: "Última edición",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">{fecha(row.original.updatedAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        // The row itself opens the form, and a click in this menu is a click
        // in the row too — its items included, which React bubbles up from the
        // portal they are drawn in. Stopped here so "Archivar" does not also
        // open the role it is archiving.
        <div className="flex justify-end pr-2" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Acciones de ${nombreDeRol(row.original)}`}
              className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted"
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => setFormulario({ rol: row.original })}>
                {puedeEditar ? "Editar" : "Ver permisos"}
              </DropdownMenuItem>
              {puedeArchivar && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setAArchivar(row.original)}
                  >
                    Archivar
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ], [rolPropio, puedeEditar, puedeArchivar, matriz]);

  const archivedColumns = useMemo<Col<RolInterface>[]>(() => [
    rowNumberColumn(),
    {
      id: "name",
      accessorFn: (rol) => nombreDeRol(rol),
      header: "Rol",
      cell: ({ row }) => (
        <span className="font-medium text-sm text-muted-foreground">{nombreDeRol(row.original)}</span>
      ),
    },
    {
      accessorKey: "deletedAt",
      header: "Archivado el",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">{fecha(row.original.deletedAt)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => puedeArchivar && (
        <div className="flex justify-end pr-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void restaurar(row.original)}>
            Desarchivar
          </Button>
        </div>
      ),
    },
    // `restaurar` only closes over setters and the two loaders, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [puedeArchivar]);

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}
      className="@container/card p-page w-full space-y-page animate-in fade-in duration-500"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles y permisos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {puedeEditar
              ? "Pulsa un rol para ver y cambiar lo que puede hacer"
              : "Pulsa un rol para ver lo que puede hacer"}
          </p>
        </div>
        <TabsList>
          <TabsTrigger value="activos">Activos</TabsTrigger>
          <TabsTrigger value="archivados">Archivados</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="activos">
        <DataTable
          data={roles}
          loading={loading}
          columns={columns}
          onRetry={() => void load()}
          onRowClick={(rol) => setFormulario({ rol })}
          initialColumnVisibility={{ createdAt: false }}
          actions={<>
            <Button variant="outline" size="icon-sm" aria-label="Refrescar" onClick={() => void load()} disabled={loading}>
              <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {puedeCrear && (
              <Button className="gap-2" aria-label="Nuevo rol" onClick={() => setFormulario({ rol: null })}>
                <PlusIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Nuevo rol</span>
              </Button>
            )}
          </>}
        />
      </TabsContent>

      <TabsContent value="archivados">
        <DataTable
          data={archivados}
          loading={loadingArchivados}
          columns={archivedColumns}
          onRetry={() => void loadArchivados()}
          actions={
            <Button variant="outline" size="icon-sm" aria-label="Refrescar" onClick={() => void loadArchivados()} disabled={loadingArchivados}>
              <RefreshCwIcon className={`h-4 w-4 ${loadingArchivados ? "animate-spin" : ""}`} />
            </Button>
          }
        />
      </TabsContent>

      <RolDialog
        rol={formulario?.rol ?? null}
        open={formulario !== null}
        onClose={() => setFormulario(null)}
        onSaved={alGuardar}
      />

      <AlertDialog open={aArchivar !== null} onOpenChange={(o) => !o && setAArchivar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar «{aArchivar ? nombreDeRol(aArchivar) : ""}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de la lista y no se le podrá asignar a nadie, pero no se borra:
              puedes restaurarlo desde la pestaña de archivados. Si alguna cuenta todavía
              tiene este rol, el sistema no dejará archivarlo y te dirá cuántas son.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archivando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-fill hover:bg-destructive-fill/90 text-white"
              onClick={(e) => { e.preventDefault(); void confirmarArchivar(); }}
              disabled={archivando}
            >
              {archivando ? "Archivando…" : "Archivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
