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
  TableProperties,
} from "lucide-react";
import { can, type Modulo } from "../lib/permissions";

export interface MenuItem {
  text: string;
  path: string;
  icon: React.ElementType;
  /**
   * The module this screen belongs to. A person sees it when they may `ver` it.
   *
   * This used to be a list of role numbers written here by hand, which meant the
   * menu and the server could disagree, and a role created from the Seguridad
   * screen appeared in neither. Naming the module instead lets both read the
   * same answer. `null` is for screens that belong to no module and everyone
   * reaches — there is exactly one, the home page.
   */
  modulo: Modulo | null;
}

export const MENU_ITEMS: MenuItem[] = [
  { text: "Inicio", path: "/app/home", icon: LayoutDashboard, modulo: null },
  { text: "Postes", path: "/app/postes", icon: CableCar, modulo: "postes" },
  { text: "Eventos", path: "/app/eventos", icon: WifiOff, modulo: "eventos" },
  { text: "Ciudades", path: "/app/ciudades", icon: MapPin, modulo: "ciudades" },
  { text: "Parametros", path: "/app/parametros", icon: Settings2, modulo: "parametros" },
  { text: "Reportes", path: "/app/reportes", icon: BarChart2, modulo: "reportes" },
  { text: "Generador", path: "/app/generador", icon: TableProperties, modulo: "generador" },
  { text: "Seguridad", path: "/app/seguridad", icon: ShieldCheck, modulo: "seguridad" },
  { text: "Archivos", path: "/app/archivos", icon: FolderOpen, modulo: "archivos" },
  { text: "Bitácora", path: "/app/bitacora", icon: ClipboardList, modulo: "bitacora" },
];

/** The screens a role may open. */
export const visibleMenuItems = (rol: number): MenuItem[] =>
  MENU_ITEMS.filter((item) => item.modulo === null || can(rol, item.modulo, "ver"));
