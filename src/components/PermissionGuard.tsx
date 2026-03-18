import { useContext } from "react";
import { ShieldOffIcon } from "lucide-react";
import { SesionContext } from "../context/SesionContext";
import { can } from "../lib/permissions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "./ui/sheet";

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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="flex flex-col items-center text-center pt-12 gap-3">
          <div className="flex items-center justify-center size-14 rounded-full bg-destructive/10 text-destructive">
            <ShieldOffIcon className="size-7" />
          </div>
          <SheetTitle>Sin acceso</SheetTitle>
          <SheetDescription>
            No tienes permisos para realizar esta acción.
          </SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
};

export default PermissionGuard;
