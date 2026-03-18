import { useContext, useState, useEffect } from "react";
import { SesionContext } from "../../context/SesionContext";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserIcon, KeyIcon, PhoneIcon, FingerprintIcon,
  ShieldCheckIcon, Loader2Icon, SaveIcon,
} from "lucide-react";
import { editUsuario, editUserName, editUserPass, searchUsuario } from "../../api/Usuario.api";
import { UsuarioInterface } from "../../interfaces/interfaces";

const PerfilPage = () => {
  const { sesion, setSesion } = useContext(SesionContext);
  const user = sesion.usuario;

  const [formData, setFormData] = useState({
    name: user.name || "",
    lastname: user.lastname || "",
    phone: "",
    birthday: "",
  });

  const [accountData, setAccountData] = useState({
    user: user.user || "",
    oldPass: "",
    pass: "",
    confirmPass: "",
  });

  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [confirmGeneral, setConfirmGeneral] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState(false);
  const [confirmPass, setConfirmPass] = useState(false);

  useEffect(() => {
    if (!user.id) return;
    setLoadingProfile(true);
    searchUsuario(user.id, sesion.token)
      .then((data: UsuarioInterface) => {
        setFormData({
          name: data.name || "",
          lastname: data.lastname || "",
          phone: data.phone || "",
          birthday: data.birthday ? String(data.birthday).slice(0, 10) : "",
        });
      })
      .catch(() => toast.error("No se pudieron cargar los datos del perfil."))
      .finally(() => setLoadingProfile(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGeneralChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.id]: e.target.value });
  };

  const saveGeneralInfo = async () => {
    setLoadingGeneral(true);
    try {
      const payload: UsuarioInterface = {
        ...user,
        name: formData.name,
        lastname: formData.lastname,
        phone: formData.phone,
        birthday: formData.birthday as unknown as Date,
      };
      const status = await editUsuario(payload, sesion.token);
      if (status === 200) {
        setSesion({ token: sesion.token, usuario: payload });
        toast.success("Información general actualizada.");
      } else {
        toast.error("Error al actualizar la información.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingGeneral(false);
  };

  const saveUsername = async () => {
    setLoadingAccount(true);
    try {
      const payload: UsuarioInterface = { ...user, user: accountData.user };
      const response = await editUserName(payload, sesion.token);
      if (response.status === 200) {
        setSesion({ token: sesion.token, usuario: payload });
        toast.success("Nombre de usuario modificado.");
      } else {
        toast.error(response.message || "Error al actualizar el usuario. Podría estar en uso.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingAccount(false);
  };

  const savePassword = async () => {
    setLoadingPass(true);
    try {
      const payload = { ...user, pass: accountData.pass, oldPass: accountData.oldPass };
      const response = await editUserPass(payload, sesion.token);
      if (response.status === 200) {
        toast.success("Contraseña actualizada con éxito.");
        setAccountData({ ...accountData, oldPass: "", pass: "", confirmPass: "" });
      } else {
        toast.error(response.message || "Error al actualizar la contraseña.");
      }
    } catch {
      toast.error("Ocurrió un error en el servidor.");
    }
    setLoadingPass(false);
  };

  const handleSaveGeneralClick = () => {
    if (!formData.name || !formData.lastname) {
      return toast.warning("Nombre y apellidos son obligatorios.");
    }
    setConfirmGeneral(true);
  };

  const handleSaveUsernameClick = () => {
    if (!accountData.user) return toast.warning("El nombre de usuario no puede estar vacío");
    setConfirmUsername(true);
  };

  const handleSavePassClick = () => {
    if (!accountData.oldPass) return toast.warning("Debe proporcionar su contraseña actual.");
    if (!accountData.pass || !accountData.confirmPass) return toast.warning("Debe rellenar ambos campos de nueva contraseña.");
    if (accountData.pass !== accountData.confirmPass) return toast.warning("Las contraseñas no coinciden.");
    if (accountData.pass.length < 6) return toast.warning("La nueva contraseña debe tener al menos 6 caracteres.");
    setConfirmPass(true);
  };

  return (
    <div className="p-6 md:p-8 w-full mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi Perfil</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Administra tu información personal y credenciales de acceso.
        </p>
      </div>

      {loadingProfile ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                {[1, 2, 3].map((j) => <Skeleton key={j} className="h-9 w-full" />)}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Columna izquierda */}
          <div className="space-y-6">

            {/* Información Personal */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Información Personal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Nombres <span className="text-destructive">*</span></Label>
                    <Input id="name" value={formData.name} onChange={handleGeneralChange} placeholder="Ej: Juan" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastname">Apellidos <span className="text-destructive">*</span></Label>
                    <Input id="lastname" value={formData.lastname} onChange={handleGeneralChange} placeholder="Ej: Pérez" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone">Teléfono</Label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input id="phone" value={formData.phone} onChange={handleGeneralChange} className="pl-8" placeholder="+591 77777777" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Fecha de Nacimiento</Label>
                  <DatePicker
                    value={formData.birthday ? new Date(formData.birthday + "T00:00:00") : undefined}
                    onSelect={(d) => setFormData((prev) => ({ ...prev, birthday: d ? d.toISOString().slice(0, 10) : "" }))}
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button onClick={handleSaveGeneralClick} disabled={loadingGeneral} className="gap-2">
                    {loadingGeneral ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                    Guardar cambios
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Rol */}
            <Card className="shadow-sm border-muted/60">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg shrink-0">
                  <ShieldCheckIcon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Permisos de sistema</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rol asignado a esta cuenta</p>
                </div>
                <Badge variant="outline" className="shrink-0">{user.rol?.name || "Administrador"}</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="space-y-6">

            {/* Nombre de usuario */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FingerprintIcon className="h-4 w-4 text-muted-foreground" />
                  Nombre de usuario
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="user">Usuario</Label>
                  <div className="flex gap-2">
                    <Input id="user" value={accountData.user} onChange={handleAccountChange} className="font-mono" />
                    <Button onClick={handleSaveUsernameClick} disabled={loadingAccount} variant="outline" className="shrink-0">
                      {loadingAccount ? <Loader2Icon className="h-4 w-4 animate-spin" /> : "Actualizar"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Usado en los registros de auditoría y para hacer login.</p>
                </div>
              </CardContent>
            </Card>

            {/* Contraseña */}
            <Card className="shadow-sm border-muted/60">
              <CardHeader className="border-b border-border/40 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyIcon className="h-4 w-4 text-muted-foreground" />
                  Contraseña
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="oldPass">Contraseña actual <span className="text-destructive">*</span></Label>
                  <Input id="oldPass" type="password" value={accountData.oldPass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pass">Nueva contraseña</Label>
                  <Input id="pass" type="password" value={accountData.pass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPass">Confirmar nueva contraseña</Label>
                  <Input id="confirmPass" type="password" value={accountData.confirmPass} onChange={handleAccountChange} className="font-mono" placeholder="••••••••" />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">Almacenada con Bcrypt en el servidor.</p>
                  <Button onClick={handleSavePassClick} disabled={loadingPass} variant="destructive" className="gap-2">
                    {loadingPass ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <SaveIcon className="h-4 w-4" />}
                    Cambiar clave
                  </Button>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Confirm: información general */}
      <AlertDialog open={confirmGeneral} onOpenChange={(o) => !o && setConfirmGeneral(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios serán reflejados inmediatamente en todo el sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmGeneral(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmGeneral(false); saveGeneralInfo(); }}>Actualizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: nombre de usuario */}
      <AlertDialog open={confirmUsername} onOpenChange={(o) => !o && setConfirmUsername(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar nombre de usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Deberás ingresar al sistema con este nuevo nombre a partir de tu próxima sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmUsername(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmUsername(false); saveUsername(); }}>Sí, cambiar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: contraseña */}
      <AlertDialog open={confirmPass} onOpenChange={(o) => !o && setConfirmPass(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar contraseña?</AlertDialogTitle>
            <AlertDialogDescription>
              Tu sesión estará atada a esta nueva clave a partir del siguiente inicio de sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmPass(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setConfirmPass(false); savePassword(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PerfilPage;
