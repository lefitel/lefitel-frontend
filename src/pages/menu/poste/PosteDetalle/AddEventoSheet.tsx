import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../../context/SesionContext";
import { createEvento } from "../../../../api/Evento.api";
import { createRevicion } from "../../../../api/Revicion.api";
import { createEventoObs } from "../../../../api/EventoObs.api";
import { getObs } from "../../../../api/Obs.api";
import { getTipoObs } from "../../../../api/TipoObs.api";
import { uploadImage } from "../../../../api/Upload.api";
import { ObsInterface, TipoObsInterface } from "../../../../interfaces/interfaces";
import { DatePicker } from "../../../../components/ui/date-picker";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { Input } from "../../../../components/ui/input";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../../../components/ui/sheet";
import { ChevronDownIcon } from "lucide-react";
import { Switch } from "../../../../components/ui/switch";
import { Checkbox } from "../../../../components/ui/checkbox";

interface Props {
  posteId: number;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function AddEventoSheet({ posteId, open, setOpen, onSuccess }: Props) {
  const { sesion } = useContext(SesionContext);

  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [revDesc, setRevDesc] = useState("");
  const [revDate, setRevDate] = useState<Date>(new Date());
  const [selectedObs, setSelectedObs] = useState<number[]>([]);
  const [expandedTipo, setExpandedTipo] = useState<number | null>(null);

  const [listObs, setListObs] = useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = useState<TipoObsInterface[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);
    Promise.all([getObs(sesion.token), getTipoObs(sesion.token)])
      .then(([obs, tipos]) => {
        setListObs(obs);
        setListTipoObs(tipos);
      })
      .catch(() => toast.error("Error al cargar las observaciones"))
      .finally(() => setLoadingData(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setDescription("");
    setPriority(false);
    setImageFile(null);
    setRevDesc("");
    setRevDate(new Date());
    setSelectedObs([]);
    setExpandedTipo(null);
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
    if (!description.trim()) {
      toast.warning("La descripción es requerida");
      return;
    }
    if (!imageFile) {
      toast.warning("La imagen es requerida");
      return;
    }
    if (selectedObs.length === 0) {
      toast.warning("Selecciona al menos una observación");
      return;
    }
    if (!revDesc.trim()) {
      toast.warning("La descripción de la revisión inicial es requerida");
      return;
    }

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
          id_poste: posteId,
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
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Nuevo Evento</SheetTitle>
          <SheetDescription>Registrar un nuevo evento en este poste</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
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
            <Switch id="priority-add" checked={priority} onCheckedChange={setPriority} />
            <Label htmlFor="priority-add" className="cursor-pointer">Evento prioritario</Label>
          </div>

          {/* Imagen */}
          <div className="space-y-1.5">
            <Label>Imagen <span className="text-destructive">*</span></Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="cursor-pointer"
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
            )}
          </div>

          {/* Revisión inicial */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Revisión inicial
            </p>
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
