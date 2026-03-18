import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { PlusIcon, MoreVerticalIcon, FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, RefreshCwIcon, ChevronRightIcon } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "../../../assets/images/logo.png";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { deletePoste, desarchivarPoste, getPoste, searchPoste } from "../../../api/Poste.api";
import { getEvento_poste } from "../../../api/Evento.api";
import { PosteInterface } from "../../../interfaces/interfaces";
import { posteExample } from "../../../data/example";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import DataTable from "../../../components/table/DataTable";
import AddPosteSheet from "../../../components/dialogs/add/AddPosteSheet";
import EditPosteSheet from "../../../components/dialogs/edits/EditPosteSheet";
import AddEventoSheet from "./PosteDetalle/AddEventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";

// ─── export helpers ───────────────────────────────────────────────────────────

const HEADERS = ["#", "Nombre", "Tramo", "Material", "Propietario", "Lat", "Lng", "Registrado"];
const PRIMARY: [number, number, number] = [0, 31, 93];
const ACCENT: [number, number, number] = [240, 244, 255];
const filename = (ext: string) => `postes_${new Date().toISOString().slice(0, 10)}.${ext}`;

const toRows = (list: PosteInterface[]) =>
    list.map((p, i) => [
        String(i + 1),
        p.name,
        `${p.ciudadA?.name ?? ""} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" />${p.ciudadB?.name ?? ""}`,
        p.material?.name ?? "",
        p.propietario?.name ?? "",
        p.lat ? String(p.lat) : "",
        p.lng ? String(p.lng) : "",
        p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-ES") : "",
    ]);

const fetchLogo = async () => {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
    return { dataUrl, buffer };
};

const exportExcel = async (list: PosteInterface[]) => {
    const { buffer: logoBuffer } = await fetchLogo();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Lefitel";
    wb.created = new Date();
    const ws = wb.addWorksheet("Postes");
    const COLS = HEADERS.length;

    const imgId = wb.addImage({ buffer: logoBuffer, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });

    ws.mergeCells(1, 2, 1, COLS);
    ws.mergeCells(2, 2, 2, COLS);
    ws.mergeCells(3, 2, 3, COLS);

    const tc = ws.getCell("B1");
    tc.value = "LEFITEL"; tc.font = { bold: true, size: 18, color: { argb: "FF001F5D" } }; tc.alignment = { vertical: "middle" };
    const sc = ws.getCell("B2");
    sc.value = "Reporte de Postes"; sc.font = { size: 12, color: { argb: "FF374151" } }; sc.alignment = { vertical: "middle" };
    const dc = ws.getCell("B3");
    dc.value = `Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`;
    dc.font = { size: 9, color: { argb: "FF9CA3AF" } }; dc.alignment = { vertical: "middle" };
    ws.getRow(1).height = 22; ws.getRow(2).height = 18; ws.getRow(3).height = 16;
    ws.addRow([]);

    ws.columns = [
        { key: "num", width: 6 },
        { key: "name", width: 14 },
        { key: "tramo", width: 30 },
        { key: "mat", width: 18 },
        { key: "prop", width: 20 },
        { key: "lat", width: 14 },
        { key: "lng", width: 14 },
        { key: "fecha", width: 14 },
    ];

    const hr = ws.addRow(HEADERS);
    hr.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    hr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF001F5D" } };
    hr.alignment = { vertical: "middle", horizontal: "center" };
    hr.height = 20;

    toRows(list).forEach((row, i) => {
        const r = ws.addRow(row);
        r.height = 16; r.alignment = { vertical: "middle" };
        if (i % 2 === 1) r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FF" } };
    });

    ws.eachRow((row, rowNum) => {
        if (rowNum < 5) return;
        row.eachCell((cell) => {
            cell.border = {
                top: { style: "thin", color: { argb: "FFD0D8EF" } },
                left: { style: "thin", color: { argb: "FFD0D8EF" } },
                bottom: { style: "thin", color: { argb: "FFD0D8EF" } },
                right: { style: "thin", color: { argb: "FFD0D8EF" } },
            };
        });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/octet-stream" }), filename("xlsx"));
};

const exportCsv = (list: PosteInterface[]) => {
    const escape = (v: string) =>
        v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [
        HEADERS.map(escape).join(","),
        ...toRows(list).map((row) => row.map(escape).join(",")),
    ];
    saveAs(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), filename("csv"));
};

const exportPdf = async (list: PosteInterface[]) => {
    const { dataUrl: logoDataUrl } = await fetchLogo();
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297;

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, 28, "F");
    doc.addImage(logoDataUrl, "PNG", 10, 4, 20, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...PRIMARY);
    doc.text("LEFITEL", 34, 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 90, 110);
    doc.text("Reporte de Postes", 34, 18);
    const dateStr = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    doc.setFontSize(8); doc.setTextColor(150, 160, 175);
    doc.text(dateStr, W - 14, 18, { align: "right" });
    doc.setFillColor(...PRIMARY);
    doc.rect(0, 28, W, 1.5, "F");

    autoTable(doc, {
        startY: 33,
        head: [HEADERS],
        body: toRows(list),
        styles: { fontSize: 7, cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 }, valign: "middle", textColor: [30, 40, 60] },
        headStyles: { fillColor: PRIMARY, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
        alternateRowStyles: { fillColor: ACCENT },
        columnStyles: {
            0: { cellWidth: 8 }, // #
            1: { cellWidth: 22 }, // Nombre
            2: { cellWidth: 44 }, // Tramo
            3: { cellWidth: 28 }, // Material
            4: { cellWidth: 32 }, // Propietario
            5: { cellWidth: 22 }, // Lat
            6: { cellWidth: 22 }, // Lng
            7: { cellWidth: 22 }, // Registrado
        },
        margin: { left: 10, right: 10 },
        tableLineColor: [208, 216, 239],
        tableLineWidth: 0.2,
    });

    const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5); doc.setTextColor(160, 170, 190);
        doc.setDrawColor(208, 216, 239);
        doc.line(10, 203, W - 10, 203);
        doc.text("Lefitel", 10, 207);
        doc.text(`Página ${i} de ${pageCount}`, W - 10, 207, { align: "right" });
    }
    doc.save(filename("pdf"));
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

const PostePage = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    const [list, setList] = useState<PosteInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<PosteInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [editPoste, setEditPoste] = useState<PosteInterface>(posteExample);
    const [openEdit, setOpenEdit] = useState(false);
    const [addEventoId, setAddEventoId] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<PosteInterface | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<PosteInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const rol = sesion.usuario.id_rol;
    const canAdd = can(rol, "postes", "crear");
    const canEdit = can(rol, "postes", "editar");
    const isAdmin = can(rol, "postes", "archivar");


    const load = useCallback(() => {
        setLoading(true);
        getPoste(sesion.token)
            .then((postes) => setList(postes ?? []))
            .catch(() => { toast.error("Error al cargar postes"); setList(null); })
            .finally(() => setLoading(false));
    }, [sesion.token]);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getPoste(sesion.token, true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar postes archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, [sesion.token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleOpenEdit = useCallback(async (id: number) => {
        try {
            const p = await searchPoste(id, sesion.token);
            setEditPoste(p);
            setOpenEdit(true);
        } catch {
            toast.error("No se pudo cargar el poste");
        }
    }, [sesion.token]);

    const handleDelete = useCallback(async () => {
        if (!confirmDelete?.id) return;
        setDeleting(true);
        try {
            const eventos = await getEvento_poste(confirmDelete.id as number, sesion.token);
            if (eventos.length > 0) { toast.error("No se puede archivar: tiene eventos asociados"); return; }
            const res = await deletePoste(confirmDelete.id as number, sesion.token);
            if (Number(res) !== 200) { toast.error("No se pudo archivar"); return; }
            toast.success("Poste archivado");
            setConfirmDelete(null);
            load();
        } catch {
            toast.error("Ocurrió un error al archivar");
        } finally {
            setDeleting(false);
        }
    }, [confirmDelete, sesion.token, load]);

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            const result = await desarchivarPoste(unarchiveTarget.id as number, sesion.token);
            if (result === 200) {
                toast.success("Poste desarchivado");
                setUnarchiveTarget(null);
                setArchivedList(null);
                load();
            } else {
                toast.error("No se pudo desarchivar");
            }
        } finally {
            setUnarchiving(false);
        }
    };

    const columns = useMemo<ColumnDef<PosteInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">{row.index + 1}</span>
            ),
        },
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left"
                    onClick={(e) => { e.stopPropagation(); navigate(`/postes/${row.original.id}`); }}
                >
                    {row.original.name}
                </button>
            ),
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.ciudadA;
                const b = row.original.ciudadB;
                return (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap">
                        {a?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/ciudades/${a.id}`); }}>{a.name}</button> : (a?.name ?? "—")}
                        <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0" />
                        {b?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/ciudades/${b.id}`); }}>{b.name}</button> : (b?.name ?? "—")}
                    </span>
                );
            },
        },
        {
            id: "material",
            header: "Material",
            cell: ({ row }) => (
                <span className="text-sm">{row.original.material?.name ?? "—"}</span>
            ),
        },
        {
            id: "propietario",
            header: "Propietario",
            cell: ({ row }) => (
                <span className="text-sm">{row.original.propietario?.name ?? "—"}</span>
            ),
        },
        {
            id: "pendientes",
            header: "Pendientes",
            enableSorting: false,
            cell: ({ row }) => {
                const count = Number((row.original as PosteInterface & { pendingEvents?: number }).pendingEvents ?? 0);
                return count > 0
                    ? <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">{count}</Badge>
                    : <span className="text-xs text-muted-foreground">—</span>;
            },
        },
        {
            id: "usuario",
            header: "Creador",
            cell: ({ row }) => {
                const u = row.original.usuario;
                return (
                    <span className="text-sm whitespace-nowrap">
                        {u ? `${u.name} ${u.lastname}` : "—"}
                    </span>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: "Registrado",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            accessorKey: "updatedAt",
            header: "Última edición",
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {row.original.updatedAt ? new Date(row.original.updatedAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                            <MoreVerticalIcon className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem onClick={() => navigate(`/postes/${row.original.id}`)}>
                                Ver detalle
                            </DropdownMenuItem>
                            {canEdit && (
                                <DropdownMenuItem onClick={() => void handleOpenEdit(row.original.id as number)}>
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {canAdd && (
                                <DropdownMenuItem onClick={() => setAddEventoId(row.original.id as number)}>
                                    Nuevo evento
                                </DropdownMenuItem>
                            )}
                            {isAdmin && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setConfirmDelete(row.original)}
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
    ], [navigate, canEdit, canAdd, isAdmin, handleOpenEdit]);

    const archivedColumns = useMemo<ColumnDef<PosteInterface>[]>(() => [
        { accessorKey: "name", header: "Nombre" },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.ciudadA;
                const b = row.original.ciudadB;
                return (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground whitespace-nowrap">
                        {a?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/ciudades/${a.id}`); }}>{a.name}</button> : (a?.name ?? "—")}
                        <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0" />
                        {b?.id ? <button className="hover:underline hover:text-foreground" onClick={(e) => { e.stopPropagation(); navigate(`/ciudades/${b.id}`); }}>{b.name}</button> : (b?.name ?? "—")}
                    </span>
                );
            },
        },
        {
            id: "material",
            header: "Material",
            cell: ({ row }) => <span className="text-sm">{row.original.material?.name ?? "—"}</span>,
        },
        {
            accessorKey: "deletedAt",
            header: "Archivado el",
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {row.original.deletedAt ? new Date(row.original.deletedAt).toLocaleDateString("es-ES") : "—"}
                </span>
            ),
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setUnarchiveTarget(row.original)}>
                        Desarchivar
                    </Button>
                </div>
            ),
        },
    ], [navigate]);

    const hasData = !!list?.length;

    return (
        <div className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Postes</h1>
                    <p className="text-sm text-muted-foreground mt-1">Red de postes registrados</p>
                </div>
                <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as InnerTab)}>
                    <TabsList>
                        <TabsTrigger value="activos">Activos</TabsTrigger>
                        <TabsTrigger value="archivados">Archivados</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {innerTab === "activos" && (
                <DataTable
                    data={list}
                    loading={loading}
                    columns={columns}
                    onRetry={load}
                    hasPaginated={true}
                    initialColumnVisibility={{ createdAt: false, updatedAt: false }}
                    actions={
                        <div className="flex gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                    disabled={!hasData}
                                >
                                    <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    Exportar
                                    <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                    <DropdownMenuItem className="gap-2" onClick={() => void exportExcel(list ?? [])}>
                                        <FileSpreadsheetIcon className="h-4 w-4 text-emerald-600" />
                                        Excel (.xlsx)
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2" onClick={() => exportCsv(list ?? [])}>
                                        <FileTextIcon className="h-4 w-4 text-blue-500" />
                                        CSV
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="gap-2" onClick={() => void exportPdf(list ?? [])}>
                                        <FileIcon className="h-4 w-4 text-red-500" />
                                        PDF
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            {canAdd && (
                                <Button className="gap-2" onClick={() => setAddOpen(true)}>
                                    <PlusIcon className="h-4 w-4" />
                                    Nuevo Poste
                                </Button>
                            )}
                        </div>
                    }
                />
            )}

            {innerTab === "archivados" && (
                <DataTable
                    data={archivedList}
                    loading={loadingArchived}
                    columns={archivedColumns}
                    onRetry={loadArchived}
                    hasPaginated={true}
                    actions={
                        <Button variant="outline" size="icon" onClick={loadArchived} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            <PermissionGuard module="postes" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <AddPosteSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="postes" action="editar" open={openEdit} onOpenChange={setOpenEdit}>
                <EditPosteSheet
                    open={openEdit}
                    setOpen={setOpenEdit}
                    poste={editPoste}
                    setPoste={setEditPoste}
                    functionApp={load}
                />
            </PermissionGuard>

            {addEventoId !== null && (
                <AddEventoSheet
                    posteId={addEventoId}
                    open={true}
                    setOpen={(v) => { if (!v) setAddEventoId(null); }}
                    onSuccess={load}
                />
            )}

            <AlertDialog open={!!confirmDelete} onOpenChange={(v) => { if (!v) setConfirmDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar poste?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El poste <strong>{confirmDelete?.name}</strong> quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleting}
                            onClick={() => void handleDelete()}
                        >
                            {deleting ? "Archivando…" : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar poste?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El poste <strong>{unarchiveTarget?.name}</strong> volverá a aparecer en las listas activas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={unarchiving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={unarchiving} onClick={handleUnarchive}>
                            {unarchiving ? "Desarchivando…" : "Desarchivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default PostePage;
