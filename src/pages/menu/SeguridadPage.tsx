import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheetIcon, FileTextIcon, FileIcon, ChevronDownIcon, MoreVerticalIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "../../assets/images/logo.png";
import { SesionContext } from "../../context/SesionContext";
import { can } from "../../lib/permissions";
import { deleteUsuario, desarchivarUsuario, getUsuario } from "../../api/Usuario.api";
import { url } from "../../api/url";
import { UsuarioInterface } from "../../interfaces/interfaces";
import { Button } from "../../components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "../../components/ui/avatar";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import DataTable from "../../components/table/DataTable";
import UsuarioSheet from "../../components/dialogs/upsert/UsuarioSheet";
import PermissionGuard from "../../components/PermissionGuard";
import { ImageLightbox } from "../../components/ui/image-viewer";

// ─── helpers ──────────────────────────────────────────────────────────────────

function UsuarioAvatar({ name, image, onImageClick }: {
    name: string;
    image: string | null | undefined;
    onImageClick: (src: string) => void;
}) {
    const [loaded, setLoaded] = useState(false);
    const imgSrc = image ? `${url}${image}` : null;
    return (
        <Avatar
            className={loaded ? "cursor-zoom-in" : ""}
            onClick={loaded ? () => onImageClick(imgSrc!) : undefined}
        >
            {imgSrc && (
                <AvatarImage
                    src={imgSrc}
                    alt={name}
                    onLoad={() => setLoaded(true)}
                    onError={() => setLoaded(false)}
                />
            )}
            <AvatarFallback>{name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
        </Avatar>
    );
}

const HEADERS = ["Nombre", "Apellido", "Usuario", "Teléfono", "Rol", "Nacimiento", "Registrado"];
const HEADER_COLOR = "001F5D";
const PRIMARY: [number, number, number] = [0, 31, 93];    // #001F5D
const ACCENT: [number, number, number] = [240, 244, 255]; // #F0F4FF

const filename = (ext: string) =>
    `usuarios_${new Date().toISOString().slice(0, 10)}.${ext}`;

const dateEs = (d: Date | string | null | undefined) =>
    d ? new Date(d).toLocaleDateString("es-ES") : "";

const toRows = (usuarios: UsuarioInterface[]) =>
    usuarios.map((u) => [
        u.name,
        u.lastname,
        u.user,
        u.phone ?? "",
        u.rol?.name ?? "",
        dateEs(u.birthday),
        dateEs(u.createdAt),
    ]);

/** Fetches the logo as base64 data URL (for jsPDF) and ArrayBuffer (for ExcelJS) */
const fetchLogo = async (): Promise<{ dataUrl: string; buffer: ArrayBuffer }> => {
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

// ─── Excel ────────────────────────────────────────────────────────────────────

const exportExcel = async (usuarios: UsuarioInterface[]) => {
    const { buffer: logoBuffer } = await fetchLogo();

    const wb = new ExcelJS.Workbook();
    wb.creator = "Osefi srl";
    wb.created = new Date();
    const ws = wb.addWorksheet("Usuarios");

    const COLS = 7;

    // Logo image (rows 1-3, column A)
    const imgId = wb.addImage({ buffer: logoBuffer, extension: "png" });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 60, height: 60 } });

    // Title rows (merged, alongside logo)
    ws.mergeCells(1, 2, 1, COLS); // B1:G1 — "OSEFI SRL"
    ws.mergeCells(2, 2, 2, COLS); // B2:G2 — subtitle
    ws.mergeCells(3, 2, 3, COLS); // B3:G3 — date

    const titleCell = ws.getCell("B1");
    titleCell.value = "OSEFI SRL";
    titleCell.font = { bold: true, size: 18, color: { argb: `FF${HEADER_COLOR}` } };
    titleCell.alignment = { vertical: "middle" };

    const subtitleCell = ws.getCell("B2");
    subtitleCell.value = "Usuarios del Sistema";
    subtitleCell.font = { size: 12, color: { argb: "FF374151" } };
    subtitleCell.alignment = { vertical: "middle" };

    const dateCell = ws.getCell("B3");
    dateCell.value = `Generado el ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}`;
    dateCell.font = { size: 9, color: { argb: "FF9CA3AF" } };
    dateCell.alignment = { vertical: "middle" };

    ws.getRow(1).height = 22;
    ws.getRow(2).height = 18;
    ws.getRow(3).height = 16;
    ws.addRow([]); // empty spacer row 4

    // Column definitions (row 5+)
    ws.columns = [
        { key: "name", width: 22 },
        { key: "lastname", width: 22 },
        { key: "user", width: 18 },
        { key: "phone", width: 16 },
        { key: "rol", width: 14 },
        { key: "birthday", width: 14 },
        { key: "createdAt", width: 14 },
    ];

    // Header row (row 5)
    const headerRow = ws.addRow(HEADERS);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${HEADER_COLOR}` } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 20;

    // Data rows
    toRows(usuarios).forEach((row, i) => {
        const r = ws.addRow(row);
        r.height = 16;
        r.alignment = { vertical: "middle" };
        if (i % 2 === 1) {
            r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F4FF" } };
        }
    });

    // Borders on data + header rows only (row 5 onward)
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

// ─── CSV ──────────────────────────────────────────────────────────────────────

const exportCsv = (usuarios: UsuarioInterface[]) => {
    const escape = (v: string) =>
        v.includes(",") || v.includes('"') || v.includes("\n")
            ? `"${v.replace(/"/g, '""')}"`
            : v;

    const lines = [
        HEADERS.map(escape).join(","),
        ...toRows(usuarios).map((row) => row.map(escape).join(",")),
    ];

    // UTF-8 BOM so Excel opens accents correctly
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, filename("csv"));
};

// ─── PDF ──────────────────────────────────────────────────────────────────────

const exportPdf = async (usuarios: UsuarioInterface[]) => {
    const { dataUrl: logoDataUrl } = await fetchLogo();

    // Portrait A4: 210 x 297 mm, usable width ~182mm with 14mm margins
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;

    // ── Header band (white background with logo + text) ──
    const BAND_H = 28;
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, W, BAND_H, "F");

    // Logo (square, left-aligned)
    doc.addImage(logoDataUrl, "PNG", 10, 4, 20, 20);

    // Company name + subtitle
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...PRIMARY);
    doc.text("OSEFI SRL", 34, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 90, 110);
    doc.text("Usuarios del Sistema", 34, 18);

    // Date (right-aligned)
    const dateStr = new Date().toLocaleDateString("es-ES", {
        day: "2-digit", month: "long", year: "numeric",
    });
    doc.setFontSize(8);
    doc.setTextColor(150, 160, 175);
    doc.text(dateStr, W - 14, 18, { align: "right" });

    // ── Blue separator line ──
    doc.setFillColor(...PRIMARY);
    doc.rect(0, BAND_H, W, 1.5, "F");

    // ── Table ──
    autoTable(doc, {
        startY: BAND_H + 5,
        head: [HEADERS],
        body: toRows(usuarios),
        styles: {
            fontSize: 8,
            cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
            valign: "middle",
            textColor: [30, 40, 60],
        },
        headStyles: {
            fillColor: PRIMARY,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8.5,
        },
        alternateRowStyles: {
            fillColor: ACCENT,
        },
        // Portrait A4 usable: ~182mm — total must fit
        columnStyles: {
            0: { cellWidth: 28 }, // Nombre
            1: { cellWidth: 28 }, // Apellido
            2: { cellWidth: 26 }, // Usuario
            3: { cellWidth: 24 }, // Teléfono
            4: { cellWidth: 20 }, // Rol
            5: { cellWidth: 24 }, // Nacimiento
            6: { cellWidth: 24 }, // Registrado  → total 154mm, centered with margins
        },
        margin: { left: 14, right: 14 },
        tableLineColor: [208, 216, 239],
        tableLineWidth: 0.2,
    });

    // ── Footer: page numbers + brand ──
    const pageCount = (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
        .internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(160, 170, 190);
        doc.text("Osefi srl", 14, 291);
        doc.text(`Página ${i} de ${pageCount}`, W - 14, 291, { align: "right" });
        // thin line above footer
        doc.setDrawColor(208, 216, 239);
        doc.line(14, 288, W - 14, 288);
    }

    doc.save(filename("pdf"));
};

// ─── Page ─────────────────────────────────────────────────────────────────────

type InnerTab = "activos" | "archivados";

const SeguridadPage = () => {
    const { sesion } = useContext(SesionContext);
    const rol = sesion.usuario.id_rol;

    const [innerTab, setInnerTab] = useState<InnerTab>("activos");

    const [list, setList] = useState<UsuarioInterface[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [archivedList, setArchivedList] = useState<UsuarioInterface[] | null>(null);
    const [loadingArchived, setLoadingArchived] = useState(false);

    const [editUser, setEditUser] = useState<UsuarioInterface | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UsuarioInterface | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [unarchiveTarget, setUnarchiveTarget] = useState<UsuarioInterface | null>(null);
    const [unarchiving, setUnarchiving] = useState(false);
    const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        getUsuario(sesion.token)
            .then((data) => setList(data ?? []))
            .catch(() => { toast.error("Error al cargar usuarios"); setList(null); })
            .finally(() => setLoading(false));
    }, [sesion.token]);

    const loadArchived = useCallback(() => {
        setLoadingArchived(true);
        getUsuario(sesion.token, true)
            .then((data) => setArchivedList(data ?? []))
            .catch(() => { toast.error("Error al cargar usuarios archivados"); setArchivedList(null); })
            .finally(() => setLoadingArchived(false));
    }, [sesion.token]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (innerTab === "archivados" && archivedList === null) loadArchived();
    }, [innerTab, archivedList, loadArchived]);

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        setDeleting(true);
        const result = await deleteUsuario(deleteTarget.id as number, sesion.token);
        if (Number(result) === 200) {
            toast.success("Usuario archivado");
            setDeleteTarget(null);
            load();
        } else {
            toast.error("No se pudo archivar");
        }
        setDeleting(false);
    };

    const handleUnarchive = async () => {
        if (!unarchiveTarget) return;
        setUnarchiving(true);
        try {
            const result = await desarchivarUsuario(unarchiveTarget.id as number, sesion.token);
            if (result === 200) {
                toast.success("Usuario desarchivado");
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

    const navigate = useNavigate();

    const columns = useMemo<ColumnDef<UsuarioInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row, table }) => {
                const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
                const { pageIndex, pageSize } = table.getState().pagination;
                return <span className="text-xs text-muted-foreground">{pageIndex * pageSize + visibleIndex + 1}</span>;
            },
        },
        {
            accessorKey: "image",
            header: "Foto",
            enableSorting: false,
            cell: ({ row }) => (
                <UsuarioAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
            ),
        },
        {
            accessorKey: "name",
            header: "Nombre",
            cell: ({ row }) => (
                <button
                    className="font-medium text-sm text-primary hover:underline text-left"
                    onClick={(e) => { e.stopPropagation(); navigate(`/app/seguridad/${row.original.id}`); }}
                >
                    {row.original.name}
                </button>
            ),
        },
        { accessorKey: "lastname", header: "Apellido" },
        { accessorKey: "user", header: "Usuario" },
        { accessorKey: "phone", header: "Teléfono" },
        {
            accessorKey: "id_rol",
            header: "Rol",
            cell: ({ row }) => row.original.rol?.name ?? `Rol ${row.original.id_rol}`,
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
                        <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onClick={() => navigate(`/app/seguridad/${row.original.id}`)}>
                                Ver detalle
                            </DropdownMenuItem>
                            {can(rol, "seguridad", "editar") && (
                                <DropdownMenuItem onClick={() => { setEditUser(row.original); setEditOpen(true); }}>
                                    Editar
                                </DropdownMenuItem>
                            )}
                            {can(rol, "seguridad", "archivar") && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget(row.original)}
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
    ], [navigate, rol]);

    const archivedColumns = useMemo<ColumnDef<UsuarioInterface>[]>(() => [
        {
            id: "num",
            header: "#",
            enableSorting: false,
            cell: ({ row, table }) => {
                const visibleIndex = table.getRowModel().rows.findIndex((r) => r.id === row.id);
                const { pageIndex, pageSize } = table.getState().pagination;
                return <span className="text-xs text-muted-foreground">{pageIndex * pageSize + visibleIndex + 1}</span>;
            },
        },
        {
            accessorKey: "image",
            header: "Foto",
            enableSorting: false,
            cell: ({ row }) => (
                <UsuarioAvatar name={row.original.name} image={row.original.image} onImageClick={setLightboxSrc} />
            ),
        },
        { accessorKey: "name", header: "Nombre" },
        { accessorKey: "lastname", header: "Apellido" },
        { accessorKey: "user", header: "Usuario" },
        {
            accessorKey: "id_rol",
            header: "Rol",
            cell: ({ row }) => row.original.rol?.name ?? `Rol ${row.original.id_rol}`,
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
    ], []);

    const hasData = !!list?.length;

    return (
        <div className="@container/card  p-4 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Seguridad</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gestión de usuarios del sistema</p>
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
                    actions={<>
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                className="inline-flex items-center gap-1.5 h-8 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-xs hover:bg-muted transition-colors disabled:opacity-50 disabled:pointer-events-none"
                                disabled={!hasData}
                            >
                                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="hidden sm:inline">Exportar</span>
                                <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => void exportExcel(list ?? [])}
                                >
                                    <FileSpreadsheetIcon className="h-4 w-4 text-emerald-600" />
                                    Excel (.xlsx)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => exportCsv(list ?? [])}
                                >
                                    <FileTextIcon className="h-4 w-4 text-blue-500" />
                                    CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => void exportPdf(list ?? [])}
                                >
                                    <FileIcon className="h-4 w-4 text-red-500" />
                                    PDF
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button variant="outline" size="icon-sm" onClick={load} disabled={loading}>
                            <RefreshCwIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </Button>
                        {can(rol, "seguridad", "crear") && (
                            <Button className="gap-2" onClick={() => setAddOpen(true)}>
                                <PlusIcon className="h-4 w-4" />
                                <span className="hidden sm:inline">Nuevo Usuario</span>
                            </Button>
                        )}
                    </>}
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
                        <Button variant="outline" size="icon-sm" onClick={loadArchived} disabled={loadingArchived}>
                            <RefreshCwIcon className={`h-4 w-4 ${loadingArchived ? "animate-spin" : ""}`} />
                        </Button>
                    }
                />
            )}

            <PermissionGuard module="seguridad" action="editar" open={editOpen} onOpenChange={setEditOpen}>
                <UsuarioSheet
                    usuario={editUser}
                    open={editOpen}
                    setOpen={setEditOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <PermissionGuard module="seguridad" action="crear" open={addOpen} onOpenChange={setAddOpen}>
                <UsuarioSheet
                    open={addOpen}
                    setOpen={setAddOpen}
                    onSuccess={load}
                />
            </PermissionGuard>

            <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Archivar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El usuario <strong>{deleteTarget?.name} {deleteTarget?.lastname}</strong> quedará archivado y dejará de aparecer en las listas.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-white"
                            disabled={deleting}
                            onClick={handleDelete}
                        >
                            {deleting ? "Archivando..." : "Archivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!unarchiveTarget} onOpenChange={(v) => { if (!v) setUnarchiveTarget(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Desarchivar usuario?</AlertDialogTitle>
                        <AlertDialogDescription>
                            El usuario <strong>{unarchiveTarget?.name} {unarchiveTarget?.lastname}</strong> volverá a aparecer en las listas activas.
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

            <ImageLightbox src={lightboxSrc ?? ""} open={!!lightboxSrc} onClose={() => setLightboxSrc(null)} />
        </div>
    );
};

export default SeguridadPage;
