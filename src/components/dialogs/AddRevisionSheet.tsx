import { useState } from "react";
import { toast } from "sonner";
import { createRevision } from "../../api/Revision.api";
import { mensajeDeError } from "../../api/descarga";
import { DatePicker } from "../ui/date-picker";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import FormDialog from "./FormDialog";

interface Props {
    eventoId: number | null;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

export default function AddRevisionSheet({ eventoId, open, setOpen, onSuccess }: Props) {
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
            await createRevision({ description, date, id_evento: eventoId });
            toast.success("Revisión agregada");
            handleClose();
            onSuccess();
        } catch (error) {
            /**
             * A failure leaves the sheet open with the text still in it.
             *
             * Two versions of this have been wrong in opposite directions, and
             * both cost something. The first awaited the call, ignored what came
             * back and announced success: a refusal, a server error and a dead
             * connection all read as "Revisión agregada", the sheet closed, and
             * the inspection somebody had just walked out to a pole to write was
             * gone with nothing on screen to say so. The second compared the
             * status against `200` — which C4 turned into `201`, so every saved
             * inspection would have reported a failure and been typed in again,
             * this time as a duplicate row.
             *
             * Neither number appears now. The call either resolves or it does
             * not, and the sentence is the server's own — "no tienes permiso
             * para registrar revisiones" arrives written by the side that
             * decided it.
             */
            toast.error(mensajeDeError(error, "No se pudo agregar la revisión. Vuelve a intentarlo."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <FormDialog
            open={open}
            onClose={handleClose}
            size="sm"
            title="Agregar revisión"
            description="Registra una nueva revisión para este evento."
            dirty={!!description.trim()}
            missing={description.trim() ? [] : ["Descripción"]}
            saving={saving}
            submitLabel="Guardar revisión"
            onSubmit={() => void handleSave()}
            bodyClassName="space-y-5"
        >
                    <div className="space-y-1.5">
                        <Label>Fecha</Label>
                        <DatePicker value={date} onSelect={(d) => d && setDate(d)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descripción <span className="text-destructive">*</span></Label>
                        <Textarea
                            className="resize-none min-h-28" aria-invalid={!!errors.description}
                            placeholder="Describe la inspección realizada..."
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors(p => ({ ...p, description: "" })); }}
                        />
                        {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
                    </div>
        </FormDialog>
    );
}
