import {
  LayoutDashboard,
  CableCar,
  WifiOff,
  Settings2,
  BarChart2,
  ShieldCheck,
  FolderOpen,
  MapPin,
  ClipboardList,
} from "lucide-react";

export interface MenuItem {
  text: string;
  path: string;
  icon: React.ElementType;
  roles: number[];
}

export const MENU_ITEMS: MenuItem[] = [
  { text: "Inicio", path: "/app/home", icon: LayoutDashboard, roles: [1, 2, 3] },
  { text: "Postes", path: "/app/postes", icon: CableCar, roles: [1, 2, 3] },
  { text: "Eventos", path: "/app/eventos", icon: WifiOff, roles: [1, 2, 3] },
  { text: "Ciudades", path: "/app/ciudades", icon: MapPin, roles: [1, 2, 3] },
  { text: "Parametros", path: "/app/parametros", icon: Settings2, roles: [1, 2] },
  { text: "Reportes", path: "/app/reportes", icon: BarChart2, roles: [1, 2, 3] },
  { text: "Seguridad", path: "/app/seguridad", icon: ShieldCheck, roles: [1] },
  { text: "Archivos", path: "/app/archivos", icon: FolderOpen, roles: [1] },
  { text: "Bitácora", path: "/app/bitacora", icon: ClipboardList, roles: [1] },
];
