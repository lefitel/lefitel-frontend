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
  { text: "Inicio", path: "/home", icon: LayoutDashboard, roles: [1, 2, 3] },
  { text: "Postes", path: "/postes", icon: CableCar, roles: [1, 2, 3] },
  { text: "Eventos", path: "/eventos", icon: WifiOff, roles: [1, 2, 3] },
  { text: "Ciudades", path: "/ciudades", icon: MapPin, roles: [1, 2, 3] },
  { text: "Parametros", path: "/parametros", icon: Settings2, roles: [1, 2] },
  { text: "Reportes", path: "/reportes", icon: BarChart2, roles: [1, 2, 3] },
  { text: "Seguridad", path: "/seguridad", icon: ShieldCheck, roles: [1] },
  { text: "Archivos", path: "/archivos", icon: FolderOpen, roles: [1] },
  { text: "Bitácora", path: "/bitacora", icon: ClipboardList, roles: [1] },
];
