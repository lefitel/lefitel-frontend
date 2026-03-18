import { useContext, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { createRevicion } from "../../../api/Revicion.api";
import { DatePicker } from "../../ui/date-picker";
import { Button } from "../../ui/button";
import { Label } from "../../ui/label";
import {
    Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../../ui/sheet";

interface Props {
    eventoId: number | null;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

export default function AddRevisionSheet({ eventoId, open, setOpen, onSuccess }: Props) {
    const { sesion } = useContext(SesionContext);
    const [description, setDescription] = useState("");
    const [date, setDate] = useState<Date>(new Date());
    const [saving, setSaving] = useState(false);

    const handleClose = () => {
        setDescription("");
        setDate(new Date());
        setOpen(false);
    };

    const handleSave = async () => {
        if (!eventoId) return;
        if (!description.trim()) return toast.warning("La descripción es requerida");
        setSaving(true);
        try {
            await createRevicion({ description, date, id_evento: eventoId }, sesion.token);
            toast.success("Revisión agregada");
            handleClose();
            onSuccess();
        } catch {
            toast.error("No se pudo agregar la revisión");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Agregar Revisión</SheetTitle>
                    <SheetDescription>Registra una nueva revisión para este evento.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <DatePicker value={date} onSelect={(d) => d && setDate(d)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <textarea
                            className="w-full min-h-28 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 placeholder:text-muted-foreground resize-none"
                            placeholder="Describe la inspección realizada..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
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
                        {saving ? "Guardando..." : "Guardar revisión"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
