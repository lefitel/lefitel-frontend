import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { SesionContext } from "../../../../context/SesionContext";
import { can } from "../../../../lib/permissions";
import { searchEvento, editEvento } from "../../../../api/Evento.api";
import { getRevicion } from "../../../../api/Revicion.api";
import { getSolucion_evento } from "../../../../api/Solucion.api";
import { uploadImage } from "../../../../api/Upload.api";
import { getEventoObs, createEventoObs, deleteEventoObs } from "../../../../api/EventoObs.api";
import { getObs } from "../../../../api/Obs.api";
import { getTipoObs } from "../../../../api/TipoObs.api";
import { url } from "../../../../api/url";
import {
  EventoInterface, EventoObsInterface, ObsInterface,
  RevicionInterface, SolucionInterface, TipoObsInterface,
} from "../../../../interfaces/interfaces";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Badge } from "../../../../components/ui/badge";
import { Skeleton } from "../../../../components/ui/skeleton";
import { Separator } from "../../../../components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../../../components/ui/sheet";
import { CalendarIcon, ChevronDownIcon, ClockIcon, ExternalLinkIcon, WrenchIcon } from "lucide-react";
import { Switch } from "../../../../components/ui/switch";
import { Checkbox } from "../../../../components/ui/checkbox";

interface Props {
  eventoId: number | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function EditEventoSheet({ eventoId, open, setOpen, onSuccess }: Props) {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [evento, setEvento] = useState<EventoInterface | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [revicions, setRevicions] = useState<RevicionInterface[]>([]);
  const [solucion, setSolucion] = useState<SolucionInterface | null>(null);

  const [listObs, setListObs] = useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = useState<TipoObsInterface[]>([]);
  const [currentEventoObs, setCurrentEventoObs] = useState<EventoObsInterface[]>([]);
  const [selectedObs, setSelectedObs] = useState<number[]>([]);
  const [expandedTipo, setExpandedTipo] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !eventoId) return;
    setLoading(true);
    Promise.all([
      searchEvento(eventoId, sesion.token),
      getRevicion(eventoId, sesion.token),
      getSolucion_evento(eventoId, sesion.token).catch(() => null),
      getEventoObs(eventoId, sesion.token),
      getObs(sesion.token),
      getTipoObs(sesion.token),
    ])
      .then(([ev, revs, sol, evObs, obs, tipos]) => {
        setEvento(ev);
        setDescription(ev.description);
        setPriority(ev.priority ?? false);
        setRevicions(revs);
        setSolucion(sol);
        setCurrentEventoObs(evObs);
        setSelectedObs(evObs.map((eo) => eo.id_obs));
        setListObs(obs);
        setListTipoObs(tipos);
      })
      .catch(() => toast.error("Error al cargar el evento"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventoId]);

  const handleClose = () => {
    setEvento(null);
    setDescription("");
    setPriority(false);
    setImageFile(null);
    setRevicions([]);
    setSolucion(null);
    setCurrentEventoObs([]);
    setSelectedObs([]);
    setExpandedTipo(null);
    setOpen(false);
  };

  const toggleObs = (id: number) => {
    setSelectedObs((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!evento?.id) return;
    if (!description.trim()) {
      toast.warning("La descripción es requerida");
      return;
    }
    if (selectedObs.length === 0) {
      toast.warning("Selecciona al menos una observación");
      return;
    }
    setSaving(true);
    try {
      let imagePath = evento.image;
      if (imageFile) {
        const uploadResult = await uploadImage(imageFile, sesion.token);
        if (uploadResult === "500") {
          toast.error("No se pudo subir la imagen");
          return;
        }
        imagePath = uploadResult;
      }

      const result = await editEvento(
        { ...evento, description, priority, image: imagePath, id_usuario: evento.id_usuario ?? sesion.usuario.id ?? 0 },
        sesion.token
      );
      if (result.status !== 200) {
        toast.error("No se pudo guardar el evento");
        return;
      }

      const toAdd = selectedObs.filter((id) => !currentEventoObs.some((eo) => eo.id_obs === id));
      const toRemove = currentEventoObs.filter((eo) => !selectedObs.includes(eo.id_obs));

      await Promise.all([
        ...toAdd.map((obsId) => createEventoObs({ id_obs: obsId, id_evento: evento.id as number }, sesion.token)),
        ...toRemove.map((eo) => deleteEventoObs(eo.id as number, sesion.token)),
      ]);

      toast.success("Evento actualizado");
      handleClose();
      onSuccess();
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const rol     = sesion.usuario.id_rol;
  const canEdit = can(rol, "eventos", "editar") && !evento?.state;

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
        <SheetContent side="right" className="sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {loading ? <Skeleton className="h-5 w-32" /> : `Evento #${evento?.id ?? ""}`}
            </SheetTitle>
            <SheetDescription>Editar los datos del evento</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-5">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : (
              <>
                {/* Info del poste (read-only) */}
                <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Poste</span>
                    {evento?.poste?.id ? (
                      <button
                        type="button"
                        className="font-medium text-primary flex items-center gap-1 hover:underline"
                        onClick={() => { handleClose(); navigate(`/postes/${evento.poste!.id}`); }}
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
                      {evento?.poste?.ciudadA?.name ?? "—"} → {evento?.poste?.ciudadB?.name ?? "—"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Propietario</span>
                    <span className="font-medium">{evento?.poste?.propietario?.name ?? "—"}</span>
                  </div>
                  {evento?.usuario && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creado por</span>
                      <span className="font-medium">
                        {evento.usuario.name} {evento.usuario.lastname}
                      </span>
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

                {evento?.state ? (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Este evento está resuelto y no puede editarse.
                  </p>
                ) : (
                  <>
                    <Separator />

                    {/* Campos editables */}
                    {canEdit && (
                      <>
                        <div className="space-y-1.5">
                          <Label>Descripción <span className="text-destructive">*</span></Label>
                          <textarea
                            className="w-full min-h-20 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            id="priority-edit"
                            checked={priority}
                            onCheckedChange={setPriority}
                          />
                          <Label htmlFor="priority-edit" className="cursor-pointer">Evento prioritario</Label>
                        </div>

                        {/* Observaciones */}
                        <div className="space-y-1.5">
                          <Label>
                            Observaciones
                            {selectedObs.length > 0 && (
                              <span className="ml-2 text-xs text-primary">({selectedObs.length})</span>
                            )}
                          </Label>
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
                                    <ChevronDownIcon
                                      className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                    />
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
                        </div>

                        <Separator />

                        {/* Imagen del evento */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Imagen</p>
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                            className="cursor-pointer"
                          />
                          {imageFile ? (
                            <img
                              src={URL.createObjectURL(imageFile)}
                              alt="preview"
                              className="max-h-48 rounded-lg object-contain border border-border"
                            />
                          ) : evento?.image ? (
                            <img
                              src={`${url}${evento.image}`}
                              alt="evento"
                              className="max-h-48 rounded-lg object-contain border border-border"
                            />
                          ) : null}
                        </div>
                      </>
                    )}

                    {/* Revisiones */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <ClockIcon className="h-3.5 w-3.5" />
                        Revisiones ({revicions.length})
                      </p>
                      {revicions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin revisiones registradas</p>
                      ) : (
                        <div className="space-y-2">
                          {revicions.map((rev, i) => (
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

                    {/* Solución */}
                    {solucion && (
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
                              <img
                                src={`${url}${solucion.image}`}
                                alt="solución"
                                className="mt-1 max-h-40 rounded-lg object-contain border border-border"
                              />
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
            <SheetFooter className="flex-row justify-end">
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} disabled={saving}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || loading}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </SheetFooter>
          ) : (
            <SheetFooter>
              <Button variant="outline" onClick={handleClose}>Cerrar</Button>
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>

    </>
  );
}
