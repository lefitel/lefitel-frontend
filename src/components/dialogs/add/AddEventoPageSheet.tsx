import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDownIcon } from "lucide-react";
import { Switch } from "../../ui/switch";
import { Checkbox } from "../../ui/checkbox";
import { SesionContext } from "../../../context/SesionContext";
import { createEvento } from "../../../api/Evento.api";
import { createRevicion } from "../../../api/Revicion.api";
import { createEventoObs } from "../../../api/EventoObs.api";
import { getObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { getPoste } from "../../../api/Poste.api";
import { uploadImage } from "../../../api/Upload.api";
import { ObsInterface, PosteInterface, TipoObsInterface } from "../../../interfaces/interfaces";
import { DatePicker } from "../../ui/date-picker";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { Combobox } from "../../ui/combobox";
import { Skeleton } from "../../ui/skeleton";
import {
    Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../ui/sheet";

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
    const [listObs, setListObs] = useState<ObsInterface[]>([]);
    const [listTipoObs, setListTipoObs] = useState<TipoObsInterface[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setLoadingData(true);
        Promise.all([getPoste(sesion.token), getObs(sesion.token), getTipoObs(sesion.token)])
            .then(([postes, obs, tipos]) => {
                setListPoste(postes);
                setListObs(obs);
                setListTipoObs(tipos);
            })
            .catch(() => toast.error("Error al cargar los datos"))
            .finally(() => setLoadingData(false));
    }, [open, sesion.token]);

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
        if (!selectedPosteId) return toast.warning("Selecciona un poste");
        if (!description.trim()) return toast.warning("La descripción es requerida");
        if (!imageFile) return toast.warning("La imagen es requerida");
        if (selectedObs.length === 0) return toast.warning("Selecciona al menos una observación");
        if (!revDesc.trim()) return toast.warning("La descripción de la revisión inicial es requerida");

        setSaving(true);
        try {
            const uploadResult = await uploadImage(imageFile, sesion.token);
            if (uploadResult === "500") {
                toast.error("No se pudo subir la imagen");
                return;
            }

            const eventoResult = await createEvento(
                {
                    description,
                    image: uploadResult,
                    date: revDate,
                    state: false,
                    priority,
                    id_poste: selectedPosteId,
                    id_usuario: sesion.usuario.id ?? 0,
                },
                sesion.token
            );

            if (eventoResult.status !== 200 && eventoResult.status !== 201) {
                toast.error("No se pudo crear el evento");
                return;
            }

            const eventoId = eventoResult.data.id as number;
            await createRevicion({ description: revDesc, date: revDate, id_evento: eventoId }, sesion.token);
            await Promise.all(
                selectedObs.map((obsId) =>
                    createEventoObs({ id_obs: obsId, id_evento: eventoId }, sesion.token)
                )
            );

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
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Nuevo Evento</SheetTitle>
                    <SheetDescription>Registrar un nuevo evento en la red</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 space-y-4">
                    {/* Poste selector */}
                    <div className="space-y-1.5">
                        <Label>Poste <span className="text-destructive">*</span></Label>
                        {loadingData ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Combobox
                                options={posteOptions}
                                value={selectedPosteId ? String(selectedPosteId) : ""}
                                onValueChange={(v) => setSelectedPosteId(Number(v))}
                                placeholder="Buscar poste..."
                            />
                        )}
                    </div>

                    {/* Tramo (read-only, derived from selected poste) */}
                    {selectedPoste && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Tramo</span>
                                <span className="font-medium">
                                    {selectedPoste.ciudadA?.name ?? "—"} → {selectedPoste.ciudadB?.name ?? "—"}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Propietario</span>
                                <span className="font-medium">{selectedPoste.propietario?.name ?? "—"}</span>
                            </div>
                        </div>
                    )}

                    {/* Descripción */}
                    <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <textarea
                            className="w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                            placeholder="Describe el problema encontrado..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    {/* Prioridad */}
                    <div className="flex items-center gap-2">
                        <Switch id="priority-page" checked={priority} onCheckedChange={setPriority} />
                        <Label htmlFor="priority-page" className="cursor-pointer">Evento prioritario</Label>
                    </div>

                    {/* Imagen */}
                    <div className="space-y-1.5">
                        <Label>Imagen <span className="text-destructive">*</span></Label>
                        <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                        />
                        {imageFile && (
                            <img
                                src={URL.createObjectURL(imageFile)}
                                alt="preview"
                                className="mt-2 max-h-40 rounded-lg object-contain border border-border"
                            />
                        )}
                    </div>

                    {/* Observaciones */}
                    <div className="space-y-1.5">
                        <Label>
                            Observaciones <span className="text-destructive">*</span>
                            {selectedObs.length > 0 && (
                                <span className="ml-2 text-xs text-primary">({selectedObs.length} seleccionadas)</span>
                            )}
                        </Label>
                        {loadingData ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-input overflow-hidden">
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
                    <div className="space-y-3 pt-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisión inicial</p>
                        <div className="space-y-1.5">
                            <Label>Fecha</Label>
                            <DatePicker value={revDate} onSelect={(d) => d && setRevDate(d)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Descripción <span className="text-destructive">*</span></Label>
                            <textarea
                                className="w-full min-h-16 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                                placeholder="Describe la inspección inicial..."
                                value={revDesc}
                                onChange={(e) => setRevDesc(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <SheetFooter>
                    <Button variant="outline" onClick={handleClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || loadingData}
                        className="bg-primary hover:bg-primary/90 text-white"
                    >
                        {saving ? "Guardando..." : "Crear evento"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
