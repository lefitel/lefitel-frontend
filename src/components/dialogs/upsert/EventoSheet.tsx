import { useContext, useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { ImageDropzone } from "../../ui/image-dropzone";
import { Textarea } from "../../ui/textarea";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import { createEvento, editEvento, searchEvento } from "../../../api/Evento.api";
import { getRevision } from "../../../api/Revision.api";
import { getSolucion_evento } from "../../../api/Solucion.api";
import { getEventoObs } from "../../../api/EventoObs.api";
import { getObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { uploadImage } from "../../../api/Upload.api";
import { url } from "../../../api/url";
import {
  EventoInterface, ObsInterface,
  RevisionInterface, SolucionInterface, TipoObsInterface,
} from "../../../interfaces/interfaces";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import { Badge } from "../../ui/badge";
import { Skeleton } from "../../ui/skeleton";
import { Separator } from "../../ui/separator";
import { DatePicker } from "../../ui/date-picker";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../ui/sheet";
import { Switch } from "../../ui/switch";
import { Checkbox } from "../../ui/checkbox";
import {
  CalendarIcon, ChevronDownIcon, ChevronRightIcon,
  ClockIcon, ExternalLinkIcon, WrenchIcon,
} from "lucide-react";

interface Props {
  eventoId?: number | null;
  posteId?: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function EventoSheet({ eventoId, posteId, open, setOpen, onSuccess }: Props) {
  const isEditing = !!eventoId;
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [evento, setEvento] = useState<EventoInterface | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Create-only fields
  const [revDesc, setRevDesc] = useState("");
  const [revDate, setRevDate] = useState<Date>(new Date());

  // Edit-only fields
  const [revisions, setRevisions] = useState<RevisionInterface[]>([]);
  const [solucion, setSolucion] = useState<SolucionInterface | null>(null);

  const [listObs, setListObs] = useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = useState<TipoObsInterface[]>([]);
  const [selectedObs, setSelectedObs] = useState<number[]>([]);
  const [expandedTipo, setExpandedTipo] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    if (isEditing && eventoId) {
      Promise.all([
        searchEvento(eventoId, sesion.token),
        getRevision(eventoId, sesion.token),
        getSolucion_evento(eventoId, sesion.token).catch(() => null),
        getEventoObs(eventoId, sesion.token),
        getObs(sesion.token),
        getTipoObs(sesion.token),
      ])
        .then(([ev, revs, sol, evObs, obs, tipos]) => {
          setEvento(ev);
          setDescription(ev.description);
          setPriority(ev.priority ?? false);
          setRevisions(revs);
          setSolucion(sol);
          setSelectedObs(evObs.map((eo) => eo.id_obs));
          setListObs(obs);
          setListTipoObs(tipos);
        })
        .catch(() => toast.error("Error al cargar el evento"))
        .finally(() => setLoading(false));
    } else {
      Promise.all([getObs(sesion.token), getTipoObs(sesion.token)])
        .then(([obs, tipos]) => {
          setListObs(obs);
          setListTipoObs(tipos);
        })
        .catch(() => toast.error("Error al cargar las observaciones"))
        .finally(() => setLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventoId]);

  const handleClose = () => {
    setEvento(null);
    setDescription("");
    setPriority(false);
    setImageFile(null);
    setRevDesc("");
    setRevDate(new Date());
    setRevisions([]);
    setSolucion(null);
    setSelectedObs([]);
    setExpandedTipo(null);
    setErrors({});
    setOpen(false);
  };

  const toggleObs = (id: number) => {
    setSelectedObs((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!description.trim()) newErrors.description = "La descripción es requerida";
    if (selectedObs.length === 0) newErrors.obs = "Selecciona al menos una observación";
    if (!isEditing) {
      if (!imageFile) newErrors.image = "La imagen es requerida";
      if (!revDesc.trim()) newErrors.revDesc = "La descripción de la revisión inicial es requerida";
    }
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      if (isEditing) {
        if (!evento?.id) return;
        let imagePath = evento.image;
        if (imageFile) {
          const r = await uploadImage(imageFile, sesion.token);
          if (r === "500") { toast.error("No se pudo subir la imagen"); return; }
          imagePath = r;
        }
        const result = await editEvento(
          { ...evento, description, priority, image: imagePath, id_usuario: evento.id_usuario ?? sesion.usuario.id ?? 0, obs_ids: selectedObs },
          sesion.token
        );
        if (result.status !== 200) { toast.error("No se pudo guardar el evento"); return; }
        toast.success("Evento actualizado");
      } else {
        const uploadResult = await uploadImage(imageFile!, sesion.token);
        if (uploadResult === "500") { toast.error("No se pudo subir la imagen"); return; }
        const result = await createEvento(
          {
            description,
            image: uploadResult,
            date: revDate,
            state: false,
            priority,
            id_poste: posteId!,
            id_usuario: sesion.usuario.id ?? 0,
            obs_ids: selectedObs,
            revision: { description: revDesc, date: revDate },
          },
          sesion.token
        );
        if (result.status !== 200 && result.status !== 201) { toast.error("No se pudo crear el evento"); return; }
        toast.success("Evento creado");
      }

      handleClose();
      onSuccess();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const canEdit = !isEditing || (can(sesion.usuario.id_rol, "eventos", "editar") && !evento?.state);

  const obsAccordion = (
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
  );

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle>
            {isEditing
              ? (loading ? <Skeleton className="h-5 w-32" /> : `Evento #${evento?.id ?? ""}`)
              : "Nuevo Evento"}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? "Editar los datos del evento" : "Registrar un nuevo evento en este poste"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <>
              {/* Edit mode: read-only info panel */}
              {isEditing && (
                <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poste</span>
                    {evento?.poste?.id ? (
                      <button
                        type="button"
                        className="font-medium text-primary flex items-center gap-1 hover:underline"
                        onClick={() => { handleClose(); navigate(`/app/postes/${evento!.poste!.id}`); }}
                      >
                        {evento.poste.name}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </button>
                    ) : (
                      <span className="font-medium">{evento?.poste?.name ?? "—"}</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tramo</span>
                    <span className="font-medium text-right">
                      {evento?.poste?.ciudadA?.name ?? "—"} <ChevronRightIcon className="inline h-3 w-3 mx-0.5 shrink-0" /> {evento?.poste?.ciudadB?.name ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Propietario</span>
                    <span className="font-medium">{evento?.poste?.propietario?.name ?? "—"}</span>
                  </div>
                  {evento?.usuario && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creado por</span>
                      <span className="font-medium">{evento.usuario.name} {evento.usuario.lastname}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Estado</span>
                    {evento?.state ? (
                      <Badge className="bg-primary/10 text-primary border-transparent shadow-none text-xs">Resuelto</Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">Pendiente</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Resolved — no editable content */}
              {isEditing && evento?.state ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Este evento está resuelto y no puede editarse.
                </p>
              ) : (
                <>
                  {isEditing && <Separator />}

                  {/* Descripción */}
                  <div className="space-y-1.5">
                    <Label>Descripción <span className="text-destructive">*</span></Label>
                    <Textarea
                      className={`resize-none min-h-20${errors.description ? " border-destructive" : ""}`}
                      placeholder="Describe el problema encontrado..."
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
                    />
                    {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                  </div>

                  {/* Prioridad */}
                  <div className="flex items-center gap-2">
                    <Switch id="evento-priority" checked={priority} onCheckedChange={setPriority} />
                    <Label htmlFor="evento-priority" className="cursor-pointer">Evento prioritario</Label>
                  </div>

                  {/* Observaciones */}
                  <div className="space-y-1.5">
                    <Label>
                      Observaciones {!isEditing && <span className="text-destructive">*</span>}
                      {selectedObs.length > 0 && (
                        <span className="ml-2 text-xs text-primary">({selectedObs.length} seleccionadas)</span>
                      )}
                    </Label>
                    {obsAccordion}
                    {errors.obs && <p className="text-xs text-destructive mt-1">{errors.obs}</p>}
                  </div>

                  {isEditing && <Separator />}

                  {/* Imagen */}
                  <div className="space-y-1.5">
                    {isEditing
                      ? <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imagen</p>
                      : <Label>Imagen <span className="text-destructive">*</span></Label>}
                    <ImageDropzone
                      file={imageFile}
                      onChange={(f) => { setImageFile(f); if (errors.image) setErrors(p => ({ ...p, image: "" })); }}
                      existingUrl={evento?.image ? `${url}${evento.image}` : undefined}
                      error={errors.image}
                    />
                  </div>

                  {/* Revisión inicial (create only) */}
                  {!isEditing && (
                    <div className="space-y-3 pt-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revisión inicial</p>
                      <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <DatePicker value={revDate} onSelect={(d) => d && setRevDate(d)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <Textarea
                          className={`resize-none min-h-16${errors.revDesc ? " border-destructive" : ""}`}
                          placeholder="Describe la inspección inicial..."
                          value={revDesc}
                          onChange={(e) => { setRevDesc(e.target.value); if (errors.revDesc) setErrors(p => ({ ...p, revDesc: "" })); }}
                        />
                        {errors.revDesc && <p className="text-xs text-destructive mt-1">{errors.revDesc}</p>}
                      </div>
                    </div>
                  )}

                  {/* Revisiones list (edit only) */}
                  {isEditing && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <ClockIcon className="h-3.5 w-3.5" />
                        Revisiones ({revisions.length})
                      </p>
                      {revisions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin revisiones registradas</p>
                      ) : (
                        <div className="space-y-2">
                          {revisions.map((rev, i) => (
                            <div key={rev.id ?? i} className="rounded-lg border border-border px-3 py-2.5 space-y-0.5">
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarIcon className="h-3 w-3" />
                                {new Date(rev.date).toLocaleDateString("es-ES")}
                              </div>
                              <p className="text-sm">{rev.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Solución (edit only) */}
                  {isEditing && solucion && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary flex items-center gap-1.5">
                          <WrenchIcon className="h-3.5 w-3.5" />
                          Solución
                        </p>
                        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarIcon className="h-3 w-3" />
                            {new Date(solucion.date).toLocaleDateString("es-ES")}
                          </div>
                          <p className="text-sm">{solucion.description}</p>
                          {solucion.image && (
                            <img src={`${url}${solucion.image}`} alt="solución" className="mt-1 max-h-40 rounded-lg object-contain border border-border" />
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {canEdit ? (
          <SheetFooter className="px-6 py-4 border-t border-border/40 flex-row justify-end">
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={saving || loading}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : isEditing ? "Guardar" : "Crear evento"}
              </Button>
            </div>
          </SheetFooter>
        ) : (
          <SheetFooter className="px-6 py-4 border-t border-border/40">
            <Button variant="outline" onClick={handleClose}>Cerrar</Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
