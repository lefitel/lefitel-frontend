import { useContext } from "react";
import { ShieldOffIcon } from "lucide-react";
import { SesionContext } from "../context/SesionContext";
import { can } from "../lib/permissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

interface Props {
  module: Parameters<typeof can>[1];
  action: Parameters<typeof can>[2];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}

const PermissionGuard = ({ module, action, open, onOpenChange, children }: Props) => {
  const { sesion } = useContext(SesionContext);

  if (can(sesion.usuario.id_rol, module, action)) return <>{children}</>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader className="flex flex-col items-center gap-3 space-y-0 border-b-0 px-6 py-10 text-center">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
            <ShieldOffIcon className="size-7" />
          </div>
          <DialogTitle>Sin acceso</DialogTitle>
          <DialogDescription>
            No tienes permisos para realizar esta acción.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

export default PermissionGuard;
