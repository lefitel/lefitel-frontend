import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { editUsuario } from "../../../api/Usuario.api";
import { uploadImage } from "../../../api/Upload.api";
import { getRol } from "../../../api/Rol.api";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Combobox } from "../../ui/combobox";
import { DatePicker } from "../../ui/date-picker";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "../../ui/sheet";

interface Props {
    usuario: UsuarioInterface | null;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

const EditUserSheet = ({ usuario, open, setOpen, onSuccess }: Props) => {
    const { sesion } = useContext(SesionContext);

    const [name, setName] = useState("");
    const [lastname, setLastname] = useState("");
    const [phone, setPhone] = useState("");
    const [birthday, setBirthday] = useState<Date | undefined>(undefined);
    const [idRol, setIdRol] = useState<number>(0);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>("");

    const [roles, setRoles] = useState<RolInterface[]>([]);
    const [saving, setSaving] = useState(false);

    const rolOptions = useMemo(
        () => roles.map((r) => ({ value: String(r.id), label: r.name })),
        [roles]
    );

    const loadRoles = useCallback(async () => {
        const data = await getRol(sesion.token);
        setRoles(data ?? []);
    }, [sesion.token]);

    useEffect(() => {
        if (!open || !usuario) return;
        setName(usuario.name);
        setLastname(usuario.lastname);
        setPhone(usuario.phone);
        setBirthday(usuario.birthday ? new Date(usuario.birthday) : undefined);
        setIdRol(usuario.id_rol);
        setImageFile(null);
        setImagePreview(usuario.image ? `${url}${usuario.image}` : "");
        loadRoles();
    }, [open, usuario, loadRoles]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (!name.trim() || !lastname.trim()) return toast.warning("Nombre y apellido son requeridos");
        if (!idRol) return toast.warning("Selecciona un rol");
        if (!usuario?.id) return;

        setSaving(true);
        let imagePath = usuario.image;

        if (imageFile) {
            const result = await uploadImage(imageFile, sesion.token);
            if (result === "500") {
                toast.error("Error al subir la imagen");
                setSaving(false);
                return;
            }
            imagePath = result;
        }

        const payload: UsuarioInterface = {
            ...usuario,
            name,
            lastname,
            phone,
            birthday: birthday ?? usuario.birthday,
            id_rol: idRol,
            image: imagePath,
        };

        const result = await editUsuario(payload, sesion.token);
        if (Number(result) === 200) {
            toast.success("Usuario actualizado");
            setOpen(false);
            onSuccess();
        } else {
            toast.error("No se pudo guardar");
        }
        setSaving(false);
    };

    return (
        <>
            <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Editar Usuario</SheetTitle>
                        <SheetDescription>Modifica los datos del usuario y guarda los cambios.</SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-4 py-4">
                        {/* Imagen */}
                        <div className="flex flex-col gap-1.5">
                            <Label>Foto</Label>
                            {imagePreview && (
                                <img
                                    src={imagePreview}
                                    alt="preview"
                                    className="h-20 w-20 rounded-full object-cover border border-border"
                                />
                            )}
                            <Input type="file" accept="image/*" onChange={handleImageChange} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="eu-name">Nombre</Label>
                            <Input id="eu-name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="eu-lastname">Apellido</Label>
                            <Input id="eu-lastname" value={lastname} onChange={(e) => setLastname(e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="eu-phone">Teléfono</Label>
                            <Input id="eu-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Fecha de nacimiento</Label>
                            <DatePicker value={birthday} onSelect={setBirthday} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="eu-user">Usuario</Label>
                            <Input id="eu-user" value={usuario?.user ?? ""} disabled />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Rol</Label>
                            <Combobox
                                options={rolOptions}
                                value={idRol ? String(idRol) : ""}
                                onValueChange={(v) => setIdRol(Number(v))}
                                placeholder="Seleccionar rol..."
                            />
                        </div>
                    </div>

                    <SheetFooter className="flex items-center justify-end px-4">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? "Guardando..." : "Guardar"}
                            </Button>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </>
    );
};

export default EditUserSheet;
