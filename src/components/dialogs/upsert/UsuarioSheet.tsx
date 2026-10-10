import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { asignarRol, createUsuario, editUsuario, searchUsuario_user } from "../../../api/Usuario.api";
import { passwordLengthError } from "../../../lib/password";
import { uploadImage } from "../../../api/Upload.api";
import { getRol } from "../../../api/Rol.api";
import { mensajeDeError } from "../../../api/descarga";
import { SesionContext } from "../../../context/SesionContext";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { imageUrl } from "../../../lib/imageUrl";
import { can } from "../../../lib/permissions";
import { nombreDeRol } from "../../../lib/roles";
import { ImageDropzone } from "../../ui/image-dropzone";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import { Combobox } from "../../ui/combobox";
import { Skeleton } from "../../ui/skeleton";
import { DatePicker } from "../../ui/date-picker";
import FormDialog from "../FormDialog";

interface Props {
    usuario?: UsuarioInterface | null;
    open: boolean;
    setOpen: (v: boolean) => void;
    onSuccess: () => void;
}

const UsuarioSheet = ({ usuario, open, setOpen, onSuccess }: Props) => {
    const isEditing = !!usuario;
    const { sesion } = useContext(SesionContext);

    /**
     * Whether the account being edited is the one doing the editing.
     *
     * The server refuses `PUT /api/usuario/:id/rol` against the caller's own
     * row unconditionally — 403 even when the role sent is the one already
     * stored — because losing your own access is the one mistake nobody else
     * can undo for you. So the role is not offered here at all in that case,
     * with the reason beside it: a picker that accepts a choice and then
     * refuses it on save is worse than one that never accepts it.
     */
    const esMiCuenta = isEditing && sesion?.usuario?.id === usuario?.id;

    /**
     * What this session may do with roles, which is not what opened this sheet.
     *
     * The sheet opens on `seguridad` — handing out accounts. Listing the roles
     * asks for `roles.ver` and changing somebody's asks for `roles.editar`,
     * separate permissions on purpose. Without them the list was asked for
     * anyway and refused, so every opening of an edit that was perfectly
     * allowed began with "No tiene permiso para realizar esta acción", over a
     * role field that looked empty and required. Now the list is only asked
     * for by somebody who may read it, and the role is only offered to
     * somebody who may change it; everybody else is shown it.
     */
    const rolSesion = sesion?.usuario?.id_rol;
    const puedeVerRoles = can(rolSesion, "roles", "ver");
    const puedeCambiarRol = puedeVerRoles && can(rolSesion, "roles", "editar");
    const rolSoloLectura = isEditing && (esMiCuenta || !puedeCambiarRol);

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

    // A role with no name is still a role somebody can hold, so it is listed —
    // under words that say what is wrong with it and which one it is, rather
    // than as a blank line nobody can tell from a gap.
    const rolOptions = useMemo(
        () => roles.map((r) => ({ value: String(r.id), label: nombreDeRol(r) })),
        [roles]
    );

    /**
     * The role this account already has, spelled out, for the one case where
     * it is shown rather than chosen.
     *
     * Falls back to the name that came with the record: the list arrives from
     * `GET /api/rol/`, which asks for `roles.ver` — a permission somebody who
     * may edit accounts can perfectly well be without, and this field must
     * still say something then.
     */
    const nombreDelRol = useMemo(
        () => rolOptions.find((o) => o.value === String(idRol))?.label
            ?? (usuario?.rol ? nombreDeRol(usuario.rol) : ""),
        [rolOptions, idRol, usuario]
    );

    /**
     * The role list, and what happens when it does not arrive.
     *
     * The `await` was bare, so a refusal threw before `setLoadingRoles(false)`
     * and left the skeleton where the role picker goes — for ever, with an
     * unhandled rejection and nothing on screen. Saving then asks for a role
     * that no control can set, so the account could never be created and the
     * person was never told why.
     *
     * C5 makes that reachable: `GET /api/rol/` used to answer any session and
     * now asks for `roles.ver`, while this sheet opens on `seguridad.crear` or
     * `seguridad.editar`. The two are separate permissions on purpose — handing
     * out accounts is not the same authority as handing out authority — so an
     * administrator can build a role that reaches here without them, and the
     * refusal has to say so rather than spin.
     */
    const loadRoles = useCallback(async () => {
        if (!puedeVerRoles) { setRoles([]); return; }
        setLoadingRoles(true);
        try {
            setRoles(await getRol() ?? []);
        } catch (error) {
            setRoles([]);
            toast.error(mensajeDeError(
                error,
                "No se pudo cargar la lista de roles, así que no se puede asignar uno.",
            ));
        } finally {
            setLoadingRoles(false);
        }
    }, [puedeVerRoles]);

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
            else {
                /**
                 * The server's length rule, from `lib/password.ts`.
                 *
                 * Not about a rate limit here — creating an account does not
                 * touch the confirmation budget — but about a dead end. The
                 * server refuses a password under `PASSWORD_MIN_LENGTH` with a
                 * sentence saying so, and `createUsuario` throws that sentence
                 * away: it flattens every failure to the number 400, so this
                 * sheet could only say "No se pudo crear el usuario" and the
                 * person had nothing to act on. Refusing here shows the reason.
                 */
                const demasiadoCorta = passwordLengthError(pass);
                if (demasiadoCorta) newErrors.pass = demasiadoCorta;
                if (pass !== confirmPass) newErrors.confirmPass = "Las contraseñas no coinciden";
            }
        }
        if (Object.keys(newErrors).length) { setErrors(newErrors); return; }

        setSaving(true);

        if (!isEditing) {
            try {
                await searchUsuario_user(user.trim());
                toast.warning("Ese nombre de usuario ya está en uso");
                setSaving(false);
                return;
            } catch { /* username available */ }
        }

        let imagePath = usuario?.image ?? "";
        if (imageFile) {
            const result = await uploadImage(imageFile);
            if (!result.ok) {
                toast.error(result.message);
                setSaving(false);
                return;
            }
            imagePath = result.path;
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
            /**
             * Saving an edit is two requests now, and this is the order and why.
             *
             * The role left `PUT /api/usuario/:id` and became a sub-resource of
             * its own, so moving somebody between roles and saving their
             * telephone number are two calls. They cannot be one, and they can
             * disagree: the second can fail after the first succeeded.
             *
             * **The role goes first.** That is the request that can be
             * interrupted: it asks for the password on every attempt, so the
             * reauthentication dialog opens every time and the person can
             * cancel it, mistype, or run out of attempts. Sending it first
             * means the likely interruption lands with **nothing written** —
             * the account is untouched, the sheet is still open with everything
             * typed into it, and pressing Guardar again retries the whole save.
             * The other order makes that same everyday cancellation land
             * *after* the profile was already saved, which is the half-done
             * write reported as "Usuario actualizado" this is here to stop.
             *
             * If the second half is the one that fails, the toast says so in
             * those words rather than claiming the save worked, and the sheet
             * stays open on the typed values. The list behind it is not
             * refreshed in that case on purpose: refreshing replaces `usuario`,
             * which resets every field in this form, and it would throw away
             * the edit the person is being asked to retry.
             */
            const cambiaElRol = idRol !== usuario!.id_rol;
            // Set after the role actually moved, not from `cambiaElRol`: the
            // sentence below claims something happened, and it may only be said
            // on the path where it did.
            let rolMovido = false;
            try {
                if (cambiaElRol) {
                    const rol = await asignarRol(usuario!.id!, idRol);
                    if (rol.status >= 400) {
                        toast.error(rol.message ?? "No se pudo cambiar el rol.");
                        setSaving(false);
                        return;
                    }
                    rolMovido = true;
                }
                await editUsuario(payload);
                toast.success("Usuario actualizado");
                setOpen(false);
                onSuccess();
            } catch (error) {
                const queFalta = mensajeDeError(error, "No se pudo guardar");
                toast.error(rolMovido
                    ? `El rol sí se cambió; el resto de los datos no. ${queFalta}`
                    : queFalta);
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
            try {
                await createUsuario(payload);
                toast.success("Usuario creado");
                setOpen(false);
                onSuccess();
            } catch (error) {
                // The server has three specific refusals here — the name is
                // taken (409), the password is too weak (400), the role is not
                // one this account may hand out (403) — and each of them
                // arrives with a sentence that says which. "No se pudo crear
                // el usuario" was the same words for all three.
                toast.error(mensajeDeError(error, "No se pudo crear el usuario"));
            }
        }

        setSaving(false);
    };

    /** Whether closing now would lose something typed. The frame asks before it does. */
    const cambiado = isEditing
        ? name !== usuario!.name || lastname !== usuario!.lastname || phone !== usuario!.phone
            || idRol !== usuario!.id_rol || !!imageFile
            || (birthday?.getTime() ?? 0) !== (usuario!.birthday ? new Date(usuario!.birthday).getTime() : 0)
        : !!(name || lastname || phone || user || pass || confirmPass || idRol || imageFile || birthday);

    return (
        <FormDialog
            open={open}
            onClose={() => setOpen(false)}
            size="lg"
            title={isEditing ? "Editar usuario" : "Nuevo usuario"}
            description={isEditing
                ? "Modifica los datos de la cuenta. El nombre de usuario y la contraseña se cambian desde su ficha."
                : "Crea una cuenta y dale un rol: el rol decide qué puede ver y hacer."}
            dirty={cambiado}
            missing={[
                !name.trim() && "Nombre",
                !lastname.trim() && "Apellido",
                !isEditing && !user.trim() && "Usuario",
                !isEditing && !pass.trim() && "Contraseña",
                !idRol && "Rol",
            ].filter((c): c is string => !!c)}
            saving={saving}
            submitLabel={isEditing ? "Guardar cambios" : "Crear usuario"}
            onSubmit={() => void handleSave()}
            bodyClassName="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-4 items-start content-start"
        >
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label>Foto</Label>
                        <ImageDropzone
                            file={imageFile}
                            onChange={setImageFile}
                            existingUrl={imageUrl(usuario?.image) ?? undefined}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="us-name">Nombre <span className="text-destructive">*</span></Label>
                        <Input id="us-name" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })); }} aria-invalid={!!errors.name} />
                        {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="us-lastname">Apellido <span className="text-destructive">*</span></Label>
                        <Input id="us-lastname" value={lastname} onChange={(e) => { setLastname(e.target.value); if (errors.lastname) setErrors(p => ({ ...p, lastname: "" })); }} aria-invalid={!!errors.lastname} />
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
                            aria-invalid={!!errors.user}
                        />
                        {errors.user && <p className="text-xs text-destructive mt-1">{errors.user}</p>}
                    </div>

                    {!isEditing && (
                        <>
                            <div className="space-y-1.5">
                                <Label htmlFor="us-pass">Contraseña <span className="text-destructive">*</span></Label>
                                <Input id="us-pass" type="password" value={pass} onChange={(e) => { setPass(e.target.value); if (errors.pass) setErrors(p => ({ ...p, pass: "" })); }} aria-invalid={!!errors.pass} />
                                {errors.pass && <p className="text-xs text-destructive mt-1">{errors.pass}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="us-confirm">Confirmar contraseña <span className="text-destructive">*</span></Label>
                                <Input id="us-confirm" type="password" value={confirmPass} onChange={(e) => { setConfirmPass(e.target.value); if (errors.confirmPass) setErrors(p => ({ ...p, confirmPass: "" })); }} aria-invalid={!!errors.confirmPass} />
                                {errors.confirmPass && <p className="text-xs text-destructive mt-1">{errors.confirmPass}</p>}
                            </div>
                        </>
                    )}

                    <div className="space-y-1.5 sm:col-span-2">
                        <Label htmlFor={rolSoloLectura ? "us-rol" : undefined}>Rol {!rolSoloLectura && <span className="text-destructive">*</span>}</Label>
                        {loadingRoles
                            ? <Skeleton className="h-9 w-full rounded-md" />
                            : rolSoloLectura
                                ? <>
                                    <Input id="us-rol" value={nombreDelRol} disabled />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {esMiCuenta
                                            ? "Nadie puede cambiar su propio rol. Pídeselo a otro administrador."
                                            : "Cambiar el rol de una cuenta necesita el permiso de ver y editar roles."}
                                    </p>
                                </>
                                : <Combobox
                                    options={rolOptions}
                                    value={idRol ? String(idRol) : ""}
                                    onValueChange={(v) => { setIdRol(Number(v)); if (errors.idRol) setErrors(p => ({ ...p, idRol: "" })); }}
                                    placeholder="Seleccionar rol..."
                                />
                        }
                        {errors.idRol && <p className="text-xs text-destructive mt-1">{errors.idRol}</p>}
                    </div>
        </FormDialog>
    );
};

export default UsuarioSheet;
