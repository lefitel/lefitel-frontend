import { useContext, useEffect, useState } from "react";
import { Textarea } from "../ui/textarea";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import { SesionContext } from "../../context/SesionContext";
import { createEvento } from "../../api/Evento.api";
import {
    estadoTrasFallo, getOpcionesEvento, EstadoOpciones, OpcionObs, OpcionSimple,
} from "../../api/opciones.api";
import { todosLosPostes } from "../../api/Poste.api";
import { uploadImage } from "../../api/Upload.api";
import { PosteInterface } from "../../interfaces/interfaces";
import { DatePicker } from "../ui/date-picker";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { ImageDropzone } from "../ui/image-dropzone";
import { Combobox } from "../ui/combobox";
import { Skeleton } from "../ui/skeleton";
import {
    Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../ui/sheet";

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

export default function AddEventoPageSheet({ open, setOpen, onSuccess }: Props) {
    const { sesion } = useContext(SesionContext);

    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [revDesc, setRevDesc] = useState("");
    const [revDate, setRevDate] = useState<Date>(new Date());
    const [selectedObs, setSelectedObs] = useState<number[]>([]);
    const [expandedTipo, setExpandedTipo] = useState<number | null>(null);
    const [selectedPosteId, setSelectedPosteId] = useState<number>(0);

    const [listPoste, setListPoste] = useState<PosteInterface[]>([]);
    const [listObs, setListObs] = useState<OpcionObs[]>([]);
    const [listTipoObs, setListTipoObs] = useState<OpcionSimple[]>([]);
    /**
     * Why the observation accordion is empty. Same reasoning as `EventoSheet`,
     * minus its editing mode: this sheet only ever creates, so without at least
     * one observation there is genuinely nothing to do here.
     *
     * Both of its mount points are already behind `eventos.ver` — the incident
     * screen through `<ModuleRoute modulo="eventos">`, the home screen through
     * `HomeRoute` — so the refused branch is not reachable today. It costs one
     * ternary, and it stops this file depending on where somebody mounts it
     * next.
     */
    const [estadoOpciones, setEstadoOpciones] = useState<EstadoOpciones>("cargando");
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!open) return;
        setLoadingData(true);
        setEstadoOpciones("cargando");

        // The pole register still comes from `?export=true`: adding a `poste`
        // block to `/api/evento/opciones` would serve the whole register under
        // `eventos.ver`, which is worse than the round trip it saves. That
        // decision belongs to C3, and until then the two loads are separate —
        // so a refusal on one does not empty the other's combobox as well.
        const postes = todosLosPostes()
            .then(setListPoste)
            .catch(() => toast.error("Error al cargar los postes"));

        const opciones = getOpcionesEvento()
            .then((o) => {
                setListObs(o.obs);
                setListTipoObs(o.tipoObs);
                setEstadoOpciones("listas");
            })
            .catch((error) => {
                setListObs([]);
                setListTipoObs([]);
                setEstadoOpciones(estadoTrasFallo(error));
            });

        Promise.all([postes, opciones]).finally(() => setLoadingData(false));
    }, [open]);

    const selectedPoste = listPoste.find((p) => p.id === selectedPosteId);

    const posteOptions = listPoste.map((p) => ({ value: String(p.id), label: p.name }));

    const resetForm = () => {
        setDescription("");
        setPriority(false);
        setImageFile(null);
        setRevDesc("");
        setRevDate(new Date());
        setSelectedObs([]);
        setExpandedTipo(null);
        setSelectedPosteId(0);
        setErrors({});
    };

    const handleClose = () => {
        resetForm();
        setOpen(false);
    };

    const toggleObs = (id: number) => {
        setSelectedObs((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        const newErrors: Record<string, string> = {};
        if (!selectedPosteId) newErrors.poste = "Selecciona un poste";
        if (!description.trim()) newErrors.description = "La descripción es requerida";
        if (!imageFile) newErrors.image = "La imagen es requerida";
        if (selectedObs.length === 0) newErrors.obs = "Selecciona al menos una observación";
        if (!revDesc.trim()) newErrors.revDesc = "La descripción de la revisión inicial es requerida";
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

        setSaving(true);
        try {
            const subida = await uploadImage(imageFile!);
            if (!subida.ok) {
                toast.error(subida.message);
                return;
            }
            const uploadResult = subida.path;

            const eventoResult = await createEvento(
                {
                    description,
                    image: uploadResult,
                    date: revDate,
                    state: false,
                    priority,
                    id_poste: selectedPosteId,
                    id_usuario: sesion.usuario.id ?? 0,
                    obs_ids: selectedObs,
                    revision: { description: revDesc, date: revDate },
                }
            );

            if (eventoResult.status !== 200 && eventoResult.status !== 201) {
                toast.error("No se pudo crear el evento");
                return;
            }

            toast.success("Evento creado");
            handleClose();
            onSuccess();
        } catch {
            toast.error("Error al crear el evento");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
            <SheetContent className="flex flex-col gap-0 p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
                    <SheetTitle>Nuevo Evento</SheetTitle>
                    <SheetDescription>Registrar un nuevo evento en la red</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-4 items-start content-start">
                    {/* Poste selector */}
                    <div className="space-y-1.5">
                        <Label>Poste <span className="text-destructive">*</span></Label>
                        {loadingData ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Combobox
                                options={posteOptions}
                                value={selectedPosteId ? String(selectedPosteId) : ""}
                                onValueChange={(v) => { setSelectedPosteId(Number(v)); if (errors.poste) setErrors(p => ({ ...p, poste: "" })); }}
                                placeholder="Buscar poste..."
                            />
                        )}
                        {errors.poste && <p className="text-xs text-destructive mt-1">{errors.poste}</p>}
                    </div>

                    {/* Prioridad — paired with Poste */}
                    <div className="space-y-1.5">
                        <Label className="invisible select-none">_</Label>
                        <div className="flex items-center gap-2 h-10">
                            <Switch id="priority-page" checked={priority} onCheckedChange={setPriority} />
                            <Label htmlFor="priority-page" className="cursor-pointer">Evento prioritario</Label>
                        </div>
                    </div>

                    {/* Tramo (read-only, derived from selected poste) */}
                    {selectedPoste && (
                        <div className="sm:col-span-2 rounded-lg bg-muted/40 px-3 py-2.5 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tramo</span>
                                <span className="font-medium">
                                    {selectedPoste.ciudadA?.name ?? "—"} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" /> {selectedPoste.ciudadB?.name ?? "—"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Propietario</span>
                                <span className="font-medium">{selectedPoste.propietario?.name ?? "—"}</span>
                            </div>
                        </div>
                    )}

                    {/* Descripción */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <Textarea
                            className="resize-none min-h-20" aria-invalid={!!errors.description}
                            placeholder="Describe el problema encontrado..."
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
                        />
                        {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                    </div>

                    {/* Imagen */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Imagen <span className="text-destructive">*</span></Label>
                        <ImageDropzone
                            file={imageFile}
                            onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
                            error={errors.image}
                        />
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>
                            Observaciones <span className="text-destructive">*</span>
                            {selectedObs.length > 0 && (
                                <span className="ml-2 text-xs text-primary">({selectedObs.length} seleccionadas)</span>
                            )}
                        </Label>
                        {errors.obs && <p className="text-xs text-destructive">{errors.obs}</p>}
                        {loadingData ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-input overflow-hidden">
                                {listTipoObs.length === 0 && (
                                    <p className="px-3 py-2.5 text-sm text-muted-foreground">
                                        {estadoOpciones === "denegado"
                                            ? "No tiene permiso para consultar las observaciones, así que no puede registrar la incidencia."
                                            : estadoOpciones === "fallo"
                                                ? "No se pudieron cargar las observaciones. Cierre y vuelva a abrir para reintentarlo."
                                                : estadoOpciones === "cargando"
                                                    ? "Cargando…"
                                                    : "Sin observaciones configuradas."}
                                    </p>
                                )}
                                {listTipoObs.map((tipo) => {
                                    const obsForTipo = listObs.filter((o) => o.id_tipoObs === tipo.id);
                                    if (obsForTipo.length === 0) return null;
                                    const isExpanded = expandedTipo === tipo.id;
                                    return (
                                        <div key={tipo.id} className="border-b border-input last:border-0">
                                            <button
                                                type="button"
                                                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
                                                onClick={() => setExpandedTipo(isExpanded ? null : (tipo.id as number))}
                                            >
                                                <span>{tipo.name}</span>
                                                <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="px-3 pb-2 grid grid-cols-1 gap-1 bg-muted/20">
                                                    {obsForTipo.map((obs) => (
                                                        <label key={obs.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                                            <Checkbox
                                                                checked={selectedObs.includes(obs.id as number)}
                                                                onCheckedChange={() => toggleObs(obs.id as number)}
                                                            />
                                                            <span className="text-xs">{obs.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Revisión inicial */}
                    <div className="space-y-1.5 sm:col-span-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisión inicial</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <DatePicker value={revDate} onSelect={(d) => d && setRevDate(d)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <Textarea
                            className="resize-none min-h-16" aria-invalid={!!errors.revDesc}
                            placeholder="Describe la inspección inicial..."
                            value={revDesc}
                            onChange={(e) => { setRevDesc(e.target.value); if (errors.revDesc) setErrors(p => ({ ...p, revDesc: "" })); }}
                        />
                        {errors.revDesc && <p className="text-xs text-destructive mt-1">{errors.revDesc}</p>}
                    </div>
                </div>

                <SheetFooter className="px-6 py-4 border-t border-border/40">
                    <Button variant="outline" onClick={handleClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loadingData}
                    >
                        {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Crear evento"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
