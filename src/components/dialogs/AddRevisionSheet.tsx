import { useContext, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../context/SesionContext";
import { createRevision } from "../../api/Revision.api";
import { DatePicker } from "../ui/date-picker";
import { Loader2Icon } from "lucide-react";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import {
    Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription,
} from "../ui/sheet";

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
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleClose = () => {
        setDescription("");
        setDate(new Date());
        setErrors({});
        setOpen(false);
    };

    const handleSave = async () => {
        if (!eventoId) return;
        const newErrors: Record<string, string> = {};
        if (!description.trim()) newErrors.description = "La descripción es requerida";
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
        setSaving(true);
        try {
            await createRevision({ description, date, id_evento: eventoId }, sesion.token);
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
            <SheetContent className="flex flex-col gap-0 p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
                    <SheetTitle>Agregar Revisión</SheetTitle>
                    <SheetDescription>Registra una nueva revisión para este evento.</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <DatePicker value={date} onSelect={(d) => d && setDate(d)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <Textarea
                            className={`resize-none min-h-28${errors.description ? " border-destructive" : ""}`}
                            placeholder="Describe la inspección realizada..."
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
                        />
                        {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                    </div>
                </div>

                <SheetFooter className="px-6 py-4 border-t border-border/40">
                    <Button variant="outline" onClick={handleClose} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary hover:bg-primary/90 text-white"
                    >
                        {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : "Guardar revisión"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
