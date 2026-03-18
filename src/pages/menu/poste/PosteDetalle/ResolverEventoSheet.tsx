import { useContext, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../../context/SesionContext";
import { editEvento } from "../../../../api/Evento.api";
import { createSolucion } from "../../../../api/Solucion.api";
import { uploadImage } from "../../../../api/Upload.api";
import { EventoInterface } from "../../../../interfaces/interfaces";
import { DatePicker } from "../../../../components/ui/date-picker";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { Input } from "../../../../components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../../../components/ui/sheet";

interface Props {
  evento: EventoInterface | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSuccess: () => void;
}

export default function ResolverEventoSheet({ evento, open, setOpen, onSuccess }: Props) {
  const { sesion } = useContext(SesionContext);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setDescription("");
    setDate(new Date());
    setImageFile(null);
    setOpen(false);
  };

  const handleSave = async () => {
    if (!evento?.id) return;
    if (!description.trim()) {
      toast.warning("La descripción de la solución es requerida");
      return;
    }
    setSaving(true);
    try {
      let imagePath = "";
      if (imageFile) {
        const uploadResult = await uploadImage(imageFile, sesion.token);
        if (uploadResult === "500") {
          toast.error("No se pudo subir la imagen");
          setSaving(false);
          return;
        }
        imagePath = uploadResult;
      }

      const solucionResult = await createSolucion(
        { description, date, image: imagePath, id_evento: evento.id as number },
        sesion.token
      );
      if (solucionResult.status !== 200 && solucionResult.status !== 201) {
        toast.error("Error al crear la solución");
        setSaving(false);
        return;
      }

      const eventoResult = await editEvento(
        { ...evento, state: true, id_usuario: evento.id_usuario ?? sesion.usuario.id ?? 0 },
        sesion.token
      );
      if (eventoResult.status === 200) {
        toast.success("Evento resuelto");
        handleClose();
        onSuccess();
      } else {
        toast.error("Solución creada pero no se pudo actualizar el estado");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Resolver Evento</SheetTitle>
          <SheetDescription>
            Documenta cómo se solucionó este evento para cerrarlo.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Fecha de resolución</Label>
            <DatePicker value={date} onSelect={(d) => d && setDate(d)} />
          </div>

          <div className="space-y-1.5">
            <Label>Descripción de la solución <span className="text-destructive">*</span></Label>
            <textarea
              className="w-full min-h-28 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
              placeholder="Describe cómo se resolvió el problema..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Imagen (opcional)</Label>
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
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {saving ? "Guardando..." : "Marcar como resuelto"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
