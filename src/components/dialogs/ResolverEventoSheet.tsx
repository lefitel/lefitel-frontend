import { useState } from "react";
import { toast } from "sonner";
import { resolverEvento } from "../../api/Evento.api";
import { mensajeDeError } from "../../api/descarga";
import { uploadImage } from "../../api/Upload.api";
import { EventoInterface } from "../../interfaces/interfaces";
import { DatePicker } from "../ui/date-picker";
import { Loader2Icon } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { ImageDropzone } from "../ui/image-dropzone";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../ui/sheet";

interface Props {
  evento: EventoInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function ResolverEventoSheet({ evento, open, setOpen, onSuccess }: Props) {
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleClose = () => {
    setDescription("");
    setDate(new Date());
    setImageFile(null);
    setErrors({});
    setOpen(false);
  };

  const handleSave = async () => {
    if (!evento?.id) return;
    const newErrors: Record<string, string> = {};
    if (!description.trim()) newErrors.description = "La descripción de la solución es requerida";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setSaving(true);
    try {
      let imagePath = "";
      if (imageFile) {
        const subida = await uploadImage(imageFile);
        if (!subida.ok) {
          toast.error(subida.message);
          setSaving(false);
          return;
        }
        imagePath = subida.path;
      }

      await resolverEvento(
        evento.id as number,
        { description, date, image: imagePath }
      );
      toast.success("Evento resuelto");
      handleClose();
      onSuccess();
    } catch (error) {
      // The sheet deliberately stays open with the text still in it, which is
      // the right call for a refusal somebody can act on — and it is also the
      // one that can duplicate work, because the photo went up before this
      // call and a retry uploads a second one. That is the trade, taken with
      // eyes open: the alternative is closing the sheet and losing what was
      // written. What makes it survivable is that the message is now the
      // server's own, so "no puedes resolver una incidencia ya resuelta" stops
      // reading as "try again".
      toast.error(mensajeDeError(error, "No se pudo resolver el evento"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <SheetTitle>Resolver Evento</SheetTitle>
          <SheetDescription>
            Documenta cómo se solucionó este evento para cerrarlo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {evento && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-1">
              <p className="text-xs text-muted-foreground">Evento a resolver</p>
              <p className="text-sm font-semibold leading-snug line-clamp-2">
                {evento.description || `Evento #${evento.id}`}
              </p>
              {evento.poste?.name && (
                <p className="text-xs text-muted-foreground">Poste: {evento.poste.name}</p>
              )}
              {evento.priority && (
                <span className="inline-block text-xs font-medium text-destructive">Alta prioridad</span>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Fecha de resolución</Label>
            <DatePicker value={date} onSelect={(d) => d && setDate(d)} />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción de la solución <span className="text-destructive">*</span></Label>
            <Textarea
              className="resize-none min-h-28" aria-invalid={!!errors.description}
              placeholder="Describe cómo se resolvió el problema..."
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Imagen (opcional)</Label>
            <ImageDropzone
              file={imageFile}
              onChange={setImageFile}
            />
          </div>
        </div>

        <SheetFooter className="px-6 py-4 border-t border-border/40">
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Marcar como resuelto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
