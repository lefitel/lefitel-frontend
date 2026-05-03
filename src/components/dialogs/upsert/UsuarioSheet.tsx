import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { createUsuario, editUsuario, searchUsuario_user } from "../../../api/Usuario.api";
import { uploadImage } from "../../../api/Upload.api";
import { getRol } from "../../../api/Rol.api";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import { Loader2Icon } from "lucide-react";
import { ImageDropzone } from "../../ui/image-dropzone";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Combobox } from "../../ui/combobox";
import { Skeleton } from "../../ui/skeleton";
import { DatePicker } from "../../ui/date-picker";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "../../ui/sheet";

interface Props {
    usuario?: UsuarioInterface | null;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

const UsuarioSheet = ({ usuario, open, setOpen, onSuccess }: Props) => {
    const isEditing = !!usuario;
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

    const [roles, setRoles] = useState<RolInterface[]>([]);
    const [loadingRoles, setLoadingRoles] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const rolOptions = useMemo(
        () => roles.map((r) => ({ value: String(r.id), label: r.name })),
        [roles]
    );

    const loadRoles = useCallback(async () => {
        setLoadingRoles(true);
        const data = await getRol(sesion.token);
        setRoles(data ?? []);
        setLoadingRoles(false);
    }, [sesion.token]);

    useEffect(() => {
        if (!open) { setErrors({}); return; }
        if (usuario) {
            setName(usuario.name);
            setLastname(usuario.lastname);
            setPhone(usuario.phone);
            setBirthday(usuario.birthday ? new Date(usuario.birthday) : undefined);
            setIdRol(usuario.id_rol);
            setImageFile(null);
        } else {
            setName("");
            setLastname("");
            setPhone("");
            setBirthday(undefined);
            setUser("");
            setPass("");
            setConfirmPass("");
            setIdRol(0);
            setImageFile(null);
        }
        loadRoles();
    }, [open, usuario, loadRoles]);


    const handleSave = async () => {
        const newErrors: Record<string, string> = {};
        if (!name.trim()) newErrors.name = "El nombre es requerido";
        if (!lastname.trim()) newErrors.lastname = "El apellido es requerido";
        if (!idRol) newErrors.idRol = "Selecciona un rol";
        if (!isEditing) {
            if (!user.trim()) newErrors.user = "El usuario es requerido";
            if (!pass.trim()) newErrors.pass = "La contraseña es requerida";
            else if (pass !== confirmPass) newErrors.confirmPass = "Las contraseñas no coinciden";
        }
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

        setSaving(true);

        if (!isEditing) {
            try {
                await searchUsuario_user(user.trim(), sesion.token);
                toast.warning("Ese nombre de usuario ya está en uso");
                setSaving(false);
                return;
            } catch { /* username available */ }
        }

        let imagePath = usuario?.image ?? "";
        if (imageFile) {
            const result = await uploadImage(imageFile, sesion.token);
            if (result === "500") {
                toast.error("Error al subir la imagen");
                setSaving(false);
                return;
            }
            imagePath = result;
        }

        if (isEditing) {
            const payload: UsuarioInterface = {
                ...usuario!,
                name,
                lastname,
                phone,
                birthday: birthday ?? usuario!.birthday,
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
        } else {
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
        }

        setSaving(false);
    };

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
            <SheetContent className="flex flex-col gap-0 p-0">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/40">
                    <SheetTitle>{isEditing ? "Editar Usuario" : "Nuevo Usuario"}</SheetTitle>
                    <SheetDescription>
                        {isEditing
                            ? "Modifica los datos del usuario y guarda los cambios."
                            : "Completa los campos para crear un nuevo usuario."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-3 items-start content-start">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Foto</Label>
                        <ImageDropzone
                            file={imageFile}
                            onChange={setImageFile}
                            existingUrl={usuario?.image ? `${url}${usuario.image}` : undefined}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="us-name">Nombre <span className="text-destructive">*</span></Label>
                        <Input id="us-name" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })); }} className={errors.name ? "border-destructive" : ""} />
                        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="us-lastname">Apellido <span className="text-destructive">*</span></Label>
                        <Input id="us-lastname" value={lastname} onChange={(e) => { setLastname(e.target.value); if (errors.lastname) setErrors(p => ({ ...p, lastname: "" })); }} className={errors.lastname ? "border-destructive" : ""} />
                        {errors.lastname && <p className="text-xs text-destructive mt-1">{errors.lastname}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="us-phone">Teléfono</Label>
                        <Input id="us-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Fecha de nacimiento</Label>
                        <DatePicker value={birthday} onSelect={setBirthday} />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor="us-user">Usuario {!isEditing && <span className="text-destructive">*</span>}</Label>
                        <Input
                            id="us-user"
                            value={isEditing ? (usuario?.user ?? "") : user}
                            onChange={!isEditing ? (e) => { setUser(e.target.value); if (errors.user) setErrors(p => ({ ...p, user: "" })); } : undefined}
                            disabled={isEditing}
                            className={errors.user ? "border-destructive" : ""}
                        />
                        {errors.user && <p className="text-xs text-destructive mt-1">{errors.user}</p>}
                    </div>

                    {!isEditing && (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="us-pass">Contraseña <span className="text-destructive">*</span></Label>
                                <Input id="us-pass" type="password" value={pass} onChange={(e) => { setPass(e.target.value); if (errors.pass) setErrors(p => ({ ...p, pass: "" })); }} className={errors.pass ? "border-destructive" : ""} />
                                {errors.pass && <p className="text-xs text-destructive mt-1">{errors.pass}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="us-confirm">Confirmar contraseña <span className="text-destructive">*</span></Label>
                                <Input id="us-confirm" type="password" value={confirmPass} onChange={(e) => { setConfirmPass(e.target.value); if (errors.confirmPass) setErrors(p => ({ ...p, confirmPass: "" })); }} className={errors.confirmPass ? "border-destructive" : ""} />
                                {errors.confirmPass && <p className="text-xs text-destructive mt-1">{errors.confirmPass}</p>}
                            </div>
                        </>
                    )}

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Rol <span className="text-destructive">*</span></Label>
                        {loadingRoles
                            ? <Skeleton className="h-9 w-full rounded-md" />
                            : <Combobox
                                options={rolOptions}
                                value={idRol ? String(idRol) : ""}
                                onValueChange={(v) => { setIdRol(Number(v)); if (errors.idRol) setErrors(p => ({ ...p, idRol: "" })); }}
                                placeholder="Seleccionar rol..."
                            />
                        }
                        {errors.idRol && <p className="text-xs text-destructive mt-1">{errors.idRol}</p>}
                    </div>
                </div>

                <SheetFooter className="px-6 py-4 border-t border-border/40">
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <><Loader2Icon className="h-4 w-4 mr-1.5 animate-spin" />Guardando…</> : isEditing ? "Guardar" : "Crear usuario"}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};

export default UsuarioSheet;
