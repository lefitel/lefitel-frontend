import {
  LayoutDashboard,
  CableCar,
  WifiOff,
  Settings2,
  BarChart2,
  ShieldCheck,
  KeyRound,
  FolderOpen,
  MapPin,
  Route as RouteIcon,
  ClipboardList,
  TableProperties,
  MailCheck,
} from "lucide-react";
import { can, type Accion, type Modulo } from "../lib/permissions";

export interface MenuItem {
  text: string;
  path: string;
  icon: React.ElementType;
  /**
   * The module this screen belongs to. A person sees it when they may `ver` it.
   *
   * This used to be a list of role numbers written here by hand, which meant the
   * menu and the server could disagree, and a role created from the roles
   * screen appeared in neither. Naming the module instead lets both read the
   * same answer. `null` is for screens that belong to no module and everyone
   * reaches — there is exactly one, the home page.
   */
  modulo: Modulo | null;
  /**
   * What the person must be able to do in that module to see this screen.
   * `ver` when absent, which is every screen but one: scheduled reports are
   * the generator's, and reading the generator is not what makes them yours
   * to set up.
   */
  accion?: Accion;
  /**
   * The titled block of the menu this screen sits in. `null` is for the one
   * screen that stands above them all, the home page.
   */
  seccion: MenuSection | null;
}

/** The blocks of the menu, in the order they are drawn. */
const MENU_SECTIONS = ["Operación", "Reportes", "Administración"] as const;
export type MenuSection = (typeof MENU_SECTIONS)[number];

/**
 * In menu order, block by block.
 *
 * What a screen is called here is what the person reads — in the menu and in
 * the trail at the top of the page — and it is not always the name of its
 * module or of its address. «Informes» is the `reportes` module at
 * `/app/reportes`: it sits under a block already titled Reportes, beside the
 * generator, which makes reports too. «Usuarios» is the `seguridad` module,
 * named for what is on the screen; its address followed the name, and
 * `/app/seguridad` redirects. No permission was renamed, so no saved role
 * changed with the names.
 */
export const MENU_ITEMS: MenuItem[] = [
  { text: "Inicio", path: "/app/home", icon: LayoutDashboard, modulo: null, seccion: null },
  { text: "Postes", path: "/app/postes", icon: CableCar, modulo: "postes", seccion: "Operación" },
  { text: "Eventos", path: "/app/eventos", icon: WifiOff, modulo: "eventos", seccion: "Operación" },
  { text: "Ciudades", path: "/app/ciudades", icon: MapPin, modulo: "ciudades", seccion: "Operación" },
  { text: "Tramos", path: "/app/tramos", icon: RouteIcon, modulo: "tramos", seccion: "Operación" },
  { text: "Informes", path: "/app/reportes", icon: BarChart2, modulo: "reportes", seccion: "Reportes" },
  { text: "Generador", path: "/app/generador", icon: TableProperties, modulo: "generador", seccion: "Reportes" },
  { text: "Envíos programados", path: "/app/envios", icon: MailCheck, modulo: "generador", accion: "programar", seccion: "Reportes" },
  { text: "Usuarios", path: "/app/usuarios", icon: ShieldCheck, modulo: "seguridad", seccion: "Administración" },
  { text: "Roles y permisos", path: "/app/roles", icon: KeyRound, modulo: "roles", seccion: "Administración" },
  { text: "Bitácora", path: "/app/bitacora", icon: ClipboardList, modulo: "bitacora", seccion: "Administración" },
  { text: "Parámetros", path: "/app/parametros", icon: Settings2, modulo: "parametros", seccion: "Administración" },
  { text: "Archivos", path: "/app/archivos", icon: FolderOpen, modulo: "archivos", seccion: "Administración" },
];

/** The screens a role may open. */
export const visibleMenuItems = (rol: number): MenuItem[] =>
  MENU_ITEMS.filter((item) => item.modulo === null || can(rol, item.modulo, item.accion ?? "ver"));

export interface MenuGroup {
  /** `null` for the untitled block at the top. */
  title: MenuSection | null;
  items: MenuItem[];
}

/**
 * The same screens, as the blocks the menu draws.
 *
 * A block this role can open nothing in is left out altogether: a title over
 * an empty space says there is something there to be had.
 */
export const visibleMenuGroups = (rol: number): MenuGroup[] => {
  const visible = visibleMenuItems(rol);
  return [null, ...MENU_SECTIONS]
    .map((title) => ({ title, items: visible.filter((item) => item.seccion === title) }))
    .filter((group) => group.items.length > 0);
};

/**
 * The first screen with real content this role can open, or null when there is
 * none.
 *
 * `visibleMenuItems(rol)[0]` cannot answer this: Inicio belongs to no module, so
 * it is always first and always present, and every caller asking "where can they
 * go" got `/app/home` back whatever the role held. That was fine while the home
 * page showed something to everyone. It stopped being fine when the dashboard
 * began asking for `eventos.ver`: a role without it now lands on a screen that
 * cannot load, and the honest answers are "somewhere else you can actually be"
 * or "nowhere — go and ask an administrator". Telling those two apart is what
 * this is for.
 */
export const firstModuleScreen = (rol: number): MenuItem | null =>
  MENU_ITEMS.find((item) => item.modulo !== null && can(rol, item.modulo, item.accion ?? "ver")) ?? null;
