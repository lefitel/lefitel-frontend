import { useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  ChevronsUpDown,
  Network,
  Smartphone,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { visibleMenuItems } from "./menuItems";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "./ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "./ui/avatar";
import { SesionContext } from "../context/SesionContext";
import logo from "../assets/images/logo.png";
import { APP_VERSION } from "../data/changelog";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useUnseenRelease } from "../hooks/useSeenRelease";
import { InstallSheet } from "./InstallSheet";


export const AppSidebar = () => {
  const { sesion, logout } = useContext(SesionContext);
  const location = useLocation();
  const rol = sesion.usuario.id_rol;

  const visibleItems = visibleMenuItems(rol);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const { canInstall, installed, platform, install } = useInstallPrompt();
  const unseenRelease = useUnseenRelease();

  const userName = `${sesion.usuario.name} ${sesion.usuario.lastname}`.trim();
  const initials = (sesion.usuario.name?.[0] ?? "") + (sesion.usuario.lastname?.[0] ?? "");

  return (
    <Sidebar collapsible="icon" className="border-none ">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex shrink-0 aspect-square size-8 items-center justify-center rounded-lg overflow-hidden bg-secondary p-1.5">
                  <img src={logo} alt="Osefi srl" className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Osefi srl</span>
                  <span className="text-xs text-muted-foreground">Sistema de gestión</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {visibleItems.map((item) => {
                const isActive =
                  location.pathname === item.path ||
                  location.pathname.startsWith(item.path + "/");
                return (
                  <SidebarMenuItem key={item.text}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.text}>
                      <Link to={item.path}>
                        <item.icon />
                        <span>{item.text}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-colors">
                <Avatar className="h-8 w-8 rounded-lg shrink-0">
                  <AvatarFallback className="rounded-lg font-semibold bg-secondary-foreground text-secondary uppercase">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight min-w-0">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs text-muted-foreground">{sesion.usuario.user}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side="top"
                align="end"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 px-3 py-2 text-left text-sm max-w-full">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg uppercase">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">{sesion.usuario.user}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app/perfil">
                    <UserCircle className="mr-2" />
                    Mi Perfil
                  </Link>
                </DropdownMenuItem>
                {/* Always here, and never dead. With a prompt in hand the
                    click installs; without one it explains how, which is the
                    common case — Safari has no prompt at all and Chrome holds
                    its own back until it has seen some use. The entry only
                    disappears once the app is installed, when there is nothing
                    left to offer. */}
                {!installed && (
                  <DropdownMenuItem
                    onClick={() => (canInstall ? void install() : setInstallHelpOpen(true))}
                  >
                    <Smartphone className="mr-2" />
                    Instalar aplicación
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/app/novedades">
                    <Sparkles className="mr-2" />
                    Novedades
                    {unseenRelease && (
                      <>
                        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        <span className="sr-only">(sin leer)</span>
                      </>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {APP_VERSION}
                    </span>
                  </Link>
                </DropdownMenuItem>
                {/* Development only. Same guard as the route in `App.tsx`,
                    and both are needed: Vite turns `import.meta.env.DEV` into
                    the literal `false` at build time, so Rollup drops this
                    entry — but an entry dropped without its route would still
                    leave the screen reachable by typing the address. */}
                {import.meta.env.DEV && (
                  <DropdownMenuItem asChild>
                    <Link to="/app/infraestructura">
                      <Network className="mr-2" />
                      Infraestructura
                      <span className="ml-auto text-xs text-muted-foreground">dev</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLogoutOpen(true)}>
                  <LogOut className="mr-2" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <InstallSheet
        platform={platform}
        open={installHelpOpen}
        onOpenChange={setInstallHelpOpen}
      />

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán tus credenciales y tendrás que volver a iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={logout}>Cerrar sesión</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SidebarRail />
    </Sidebar>
  );
};
