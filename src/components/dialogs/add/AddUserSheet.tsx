import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { createUsuario, searchUsuario_user } from "../../../api/Usuario.api";
import { uploadImage } from "../../../api/Upload.api";
import { getRol } from "../../../api/Rol.api";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Combobox } from "../../ui/combobox";
import { DatePicker } from "../../ui/date-picker";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "../../ui/sheet";

interface Props {
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

const AddUserSheet = ({ open, setOpen, onSuccess }: Props) => {
    const { sesion } = useContext(SesionContext);

    const [name, setName] = useState("");
    const [lastname, setLastname] = useState("");
    const [phone, setPhone] = useState("");
    const [birthday, setBirthday] = useState<Date | undefined>(undefined);
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [confirmPass, setConfirmPass] = useState("");
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
        if (!open) return;
        setName("");
        setLastname("");
        setPhone("");
        setBirthday(undefined);
        setUser("");
        setPass("");
        setConfirmPass("");
        setIdRol(0);
        setImageFile(null);
        setImagePreview("");
        loadRoles();
    }, [open, loadRoles]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSave = async () => {
        if (!name.trim() || !lastname.trim()) return toast.warning("Nombre y apellido son requeridos");
        if (!user.trim()) return toast.warning("El usuario es requerido");
        if (!pass.trim()) return toast.warning("La contraseña es requerida");
        if (pass !== confirmPass) return toast.warning("Las contraseñas no coinciden");
        if (!idRol) return toast.warning("Selecciona un rol");

        setSaving(true);
        try {
            await searchUsuario_user(user.trim(), sesion.token);
            toast.warning("Ese nombre de usuario ya está en uso");
            setSaving(false);
            return;
        } catch { /* no existe, se puede continuar */ }
        let imagePath = "";

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
            name,
            lastname,
            phone,
            birthday: birthday ?? new Date(),
            user,
            pass,
            id_rol: idRol,
            image: imagePath,
        };

        const result = await createUsuario(payload, sesion.token);
        if (Number(result) === 200 || Number(result) === 201) {
            toast.success("Usuario creado");
            setOpen(false);
            onSuccess();
        } else {
            toast.error("No se pudo crear el usuario");
        }
        setSaving(false);
    };

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Nuevo Usuario</SheetTitle>
                    <SheetDescription>Completa los campos para crear un nuevo usuario.</SheetDescription>
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
                        <Label htmlFor="au-name">Nombre</Label>
                        <Input id="au-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="au-lastname">Apellido</Label>
                        <Input id="au-lastname" value={lastname} onChange={(e) => setLastname(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="au-phone">Teléfono</Label>
                        <Input id="au-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label>Fecha de nacimiento</Label>
                        <DatePicker value={birthday} onSelect={setBirthday} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="au-user">Usuario</Label>
                        <Input id="au-user" value={user} onChange={(e) => setUser(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="au-pass">Contraseña</Label>
                        <Input id="au-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="au-confirm">Confirmar contraseña</Label>
                        <Input id="au-confirm" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
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
    );
};

export default AddUserSheet;
