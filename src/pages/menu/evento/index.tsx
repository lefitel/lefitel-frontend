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
import { deleteEvento, desarchivarEvento, getEvento, reabrirEvento } from "../../../api/Evento.api";
import { EventoInterface } from "../../../interfaces/interfaces";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import DataTable from "../../../components/table/DataTable";
import AddEventoPageSheet from "../../../components/dialogs/add/AddEventoPageSheet";
import AddRevisionSheet from "../../../components/dialogs/add/AddRevisionSheet";
import ResolverEventoSheet from "../poste/PosteDetalle/ResolverEventoSheet";
import EditEventoSheet from "../poste/PosteDetalle/EditEventoSheet";
import PermissionGuard from "../../../components/PermissionGuard";

// ─── export helpers ───────────────────────────────────────────────────────────

const HEADERS = ["#", "Poste", "Tramo", "Propietario", "Descripción", "Estado", "Prioritario", "Última revisión", "Observaciones"];
const PRIMARY: [number, number, number] = [0, 31, 93];
const ACCENT: [number, number, number] = [240, 244, 255];
const filename = (ext: string) => `eventos_${new Date().toISOString().slice(0, 10)}.${ext}`;

const toRows = (list: EventoInterface[]) =>
    list.map((e, i) => [
        String(i + 1),
        e.poste?.name ?? "",
        `${e.poste?.ciudadA?.name ?? ""} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" />${e.poste?.ciudadB?.name ?? ""}`,
        e.poste?.propietario?.name ?? "",
        e.description,
        e.state ? "Resuelto" : "Pendiente",
        e.priority ? "Sí" : "No",
        e.revicions?.length
            ? new Date(Math.max(...e.revicions.map((r) => new Date(r.date).getTime()))).toLocaleDateString("es-ES")
            : "",
        e.eventoObs?.map((eo) => eo.ob?.name).filter(Boolean).join(", ") ?? "",
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

const exportExcel = async (list: EventoInterface[]) => {
    const { buffer: logoBuffer } = await fetchLogo();
    const wb = new ExcelJS.Workbook();
    wb.creator = "Lefitel";
    wb.created = new Date();
    const ws = wb.addWorksheet("Eventos");
    const COLS = HEADERS.length;

    const imgId = wb.addImage({ buffer: logoBuffer, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });

    ws.mergeCells(1, 2, 1, COLS);
    ws.mergeCells(2, 2, 2, COLS);
    ws.mergeCells(3, 2, 3, COLS);

    const tc = ws.getCell("B1");
    tc.value = "LEFITEL"; tc.font = { bold: true, size: 18, color: { argb: "FF001F5D" } }; tc.alignment = { vertical: "middle" };
    const sc = ws.getCell("B2");
    sc.value = "Eventos del Sistema"; sc.font = { size: 12, color: { argb: "FF374151" } }; sc.alignment = { vertical: "middle" };
    const dc = ws.getCell("B3");
    dc.value = `Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`;
    dc.font = { size: 9, color: { argb: "FF9CA3AF" } }; dc.alignment = { vertical: "middle" };
    ws.getRow(1).height = 22; ws.getRow(2).height = 18; ws.getRow(3).height = 16;
    ws.addRow([]);

    ws.columns = [
        { key: "num", width: 6 },
        { key: "poste", width: 18 },
        { key: "tramo", width: 28 },
        { key: "prop", width: 18 },
        { key: "desc", width: 32 },
        { key: "estado", width: 12 },
        { key: "prior", width: 12 },
        { key: "ultima", width: 16 },
        { key: "obs", width: 40 },
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

const exportCsv = (list: EventoInterface[]) => {
    const escape = (v: string) =>
        v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [
        HEADERS.map(escape).join(","),
        ...toRows(list).map((row) => row.map(escape).join(",")),
    ];
    saveAs(new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }), filename("csv"));
};

const exportPdf = async (list: EventoInterface[]) => {
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
    doc.text("Eventos del Sistema", 34, 18);
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
            1: { cellWidth: 24 }, // Poste
            2: { cellWidth: 38 }, // Tramo
            3: { cellWidth: 26 }, // Propietario
            4: { cellWidth: 40 }, // Descripción
            5: { cellWidth: 20 }, // Estado
            6: { cellWidth: 20 }, // Prioritario
            7: { cellWidth: 24 }, // Última rev.
            8: { cellWidth: 49 }, // Observaciones
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
        doc.line(10, 208, W - 10, 208);
        doc.text("Lefitel", 10, 212);
        doc.text(`Página ${i} de ${pageCount}`, W - 10, 212, { align: "right" });
    }
    doc.save(filename("pdf"));
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

const EventoPage = () => {
    const { sesion } = useContext(SesionContext);
    const navigate = useNavigate();

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    const [list, setList] = useState<EventoInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<EventoInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);

    const [editId, setEditId] = useState<number | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [resolverEvento, setResolverEvento] = useState<EventoInterface | null>(null);
    const [revisionId, setRevisionId] = useState<number | null>(null);
    const [addOpen, setAddOpen] = useState(false);
    const [reabrirId, setReabrirId] = useState<number | null>(null);
    const [reabriendo, setReabriendo] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<EventoInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);

    const rol    = sesion.usuario.id_rol;
    const canAdd = can(rol, "eventos", "crear");

    const load = useCallback(() => {
        setLoading(true);
        getEvento(sesion.token)
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar eventos"); setList(null); })
            .finally(() => setLoading(false));
    }, [sesion.token]);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getEvento(sesion.token, true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar eventos archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, [sesion.token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleDelete = async () => {
        if (!deleteId) return;
        setDeleting(true);
        const status = await deleteEvento(deleteId, sesion.token);
        setDeleting(false);
        setDeleteId(null);
        if (status === 200) {
            toast.success("Evento archivado.");
            load();
        } else {
            toast.error("Error al archivar el evento.");
        }
    };

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            const result = await desarchivarEvento(unarchiveTarget.id as number, sesion.token);
            if (result === 200) {
                toast.success("Evento desarchivado");
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

    const columns = useMemo<ColumnDef<EventoInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">{row.index + 1}</span>
            ),
        },
        {
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left line-clamp-2 max-w-xs"
                    onClick={(e) => { e.stopPropagation(); navigate(`/eventos/${row.original.id}`); }}
                >
                    {row.original.description}
                </button>
            ),
        },
        {
            accessorKey: "poste",
            header: "Poste",
            cell: ({ row }) => (
                <button
                    className="text-sm hover:underline text-left whitespace-nowrap"
                    onClick={(e) => { e.stopPropagation(); navigate(`/postes/${row.original.id_poste}`); }}
                >
                    {row.original.poste?.name ?? "—"}
                </button>
            ),
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.poste?.ciudadA;
                const b = row.original.poste?.ciudadB;
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
            id: "propietario",
            header: "Propietario",
            cell: ({ row }) => (
                <span className="text-sm">{row.original.poste?.propietario?.name ?? "—"}</span>
            ),
        },
        {
            accessorKey: "state",
            header: "Estado",
            cell: ({ row }) => row.original.state
                ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
                : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>,
        },
        {
            accessorKey: "priority",
            header: "Prior.",
            cell: ({ row }) => row.original.priority
                ? <Badge className="bg-red-500/10 text-red-600 border-transparent shadow-none text-xs">Sí</Badge>
                : <span className="text-xs text-muted-foreground">No</span>,
        },
        {
            id: "ultimaRev",
            header: "Última revisión",
            cell: ({ row }) => {
                const revs = row.original.revicions ?? [];
                if (!revs.length) return <span className="text-xs text-muted-foreground">—</span>;
                const max = new Date(Math.max(...revs.map((r) => new Date(r.date).getTime())));
                return <span className="text-xs whitespace-nowrap">{max.toLocaleDateString("es-ES")}</span>;
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
            id: "obs",
            header: "Observaciones",
            enableSorting: false,
            cell: ({ row }) => {
                const obs = row.original.eventoObs ?? [];
                if (!obs.length) return <span className="text-xs text-muted-foreground">—</span>;
                return (
                    <span className="text-xs text-muted-foreground">
                        ({obs.length}) {obs.map((eo) => eo.ob?.name).filter(Boolean).join(", ")}
                    </span>
                );
            },
        },
        {
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }) => {
                const e = row.original;
                const isPending = !e.state;
                const canAct      = can(sesion.usuario.id_rol, "eventos", "editar");
                const canArchivar = can(sesion.usuario.id_rol, "eventos", "archivar");
                return (
                    <div className="flex justify-end pr-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors data-[state=open]:bg-muted">
                                <MoreVerticalIcon className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => navigate(`/eventos/${e.id}`)}>
                                    Ver detalle
                                </DropdownMenuItem>
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setEditId(e.id as number)}>
                                        Editar
                                    </DropdownMenuItem>
                                )}
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setRevisionId(e.id as number)}>
                                        Agregar revisión
                                    </DropdownMenuItem>
                                )}
                                {canAct && isPending && (
                                    <DropdownMenuItem onClick={() => setResolverEvento(e)}>
                                        Resolver
                                    </DropdownMenuItem>
                                )}
                                {canAct && !isPending && (
                                    <DropdownMenuItem
                                        className="text-amber-600 focus:text-amber-600"
                                        onClick={() => setReabrirId(e.id as number)}
                                    >
                                        Des-resolver
                                    </DropdownMenuItem>
                                )}
                                {canArchivar && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onClick={() => setDeleteId(e.id as number)}
                                        >
                                            Archivar
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ], [sesion.usuario.id_rol, navigate]);

    const archivedColumns = useMemo<ColumnDef<EventoInterface>[]>(() => [
        {
            accessorKey: "poste",
            header: "Poste",
            cell: ({ row }) => <span className="text-sm font-medium">{row.original.poste?.name ?? "—"}</span>,
        },
        {
            id: "tramo",
            header: "Tramo",
            cell: ({ row }) => {
                const a = row.original.poste?.ciudadA;
                const b = row.original.poste?.ciudadB;
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
            accessorKey: "description",
            header: "Descripción",
            cell: ({ row }) => <span className="text-sm line-clamp-2 max-w-xs">{row.original.description}</span>,
        },
        {
            accessorKey: "state",
            header: "Estado",
            cell: ({ row }) => row.original.state
                ? <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
                : <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>,
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
        <div className=" @container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
                    <p className="text-sm text-muted-foreground mt-1">Registro de incidencias en la red</p>
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
                                    Nuevo Evento
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

            <PermissionGuard module="eventos" action="editar" open={editId !== null} onOpenChange={(v) => { if (!v) setEditId(null); }}>
                <EditEventoSheet
                    eventoId={editId}
                    open={editId !== null}
                    setOpen={(v: boolean) => { if (!v) setEditId(null); }}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="eventos" action="editar" open={resolverEvento !== null} onOpenChange={(v) => { if (!v) setResolverEvento(null); }}>
                <ResolverEventoSheet
                    evento={resolverEvento}
                    open={resolverEvento !== null}
                    setOpen={(v) => { if (!v) setResolverEvento(null); }}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AddRevisionSheet
                eventoId={revisionId}
                open={revisionId !== null}
                setOpen={(v) => { if (!v) setRevisionId(null); }}
                onSuccess={load}
            />

            <PermissionGuard module="eventos" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <AddEventoPageSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AlertDialog open={reabrirId !== null} onOpenChange={(v) => { if (!v) setReabrirId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Des-resolver evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se eliminará la solución registrada y el evento volverá a estado pendiente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={reabriendo}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={reabriendo}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                            onClick={async () => {
                                if (!reabrirId) return;
                                setReabriendo(true);
                                const status = await reabrirEvento(reabrirId, sesion.token);
                                setReabriendo(false);
                                if (status === 200) {
                                    toast.success("Evento reabierto");
                                    setReabrirId(null);
                                    load();
                                } else {
                                    toast.error("Error al des-resolver el evento");
                                }
                            }}
                        >
                            {reabriendo ? "Procesando..." : "Des-resolver"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteId !== null} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El evento quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            disabled={deleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleting ? "Archivando..." : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar evento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El evento volverá a aparecer en las listas activas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={unarchiving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction disabled={unarchiving} onClick={handleUnarchive}>
                            {unarchiving ? "Desarchivando..." : "Desarchivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default EventoPage;
