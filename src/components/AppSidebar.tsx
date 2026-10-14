import { useContext, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  ChevronsUpDown,
  Moon,
  Network,
  Smartphone,
  Sparkles,
  UserCircle,
} from "lucide-react";
import { visibleMenuGroups } from "./menuItems";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
import { Switch } from "./ui/switch";
import { SesionContext } from "../context/SesionContext";
import logo from "../assets/images/logo.png";
import { APP_VERSION } from "../data/changelog";
import { useInstallPrompt } from "../hooks/useInstallPrompt";
import { useUnseenRelease } from "../hooks/useSeenRelease";
import { InstallSheet } from "./InstallSheet";
import { useTheme } from "./theme-provider";


export const AppSidebar = () => {
  const { sesion, logout } = useContext(SesionContext);
  const location = useLocation();
  const rol = sesion.usuario.id_rol;

  const groups = visibleMenuGroups(rol);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const { canInstall, installed, platform, install } = useInstallPrompt();
  const unseenRelease = useUnseenRelease();
  const { resolvedTheme, setTheme } = useTheme();

  const userName = `${sesion.usuario.name} ${sesion.usuario.lastname}`.trim();
  const initials = (sesion.usuario.name?.[0] ?? "") + (sesion.usuario.lastname?.[0] ?? "");

  return (
    <Sidebar collapsible="icon" className="border-none ">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Folded, the button shrinks from 48px to the 32px square, and the
                logo rode up 8px with it, off the line of the app's header.
                The margin gives those 16px back, so the logo stays where it
                was — and eases with the height, or it would jump first. */}
            <SidebarMenuButton
              size="lg"
              asChild
              className="transition-[width,height,padding,margin] group-data-[collapsible=icon]:my-2"
            >
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
        {/*
          One block per section, each under its title. Folded down to icons the
          titles have no room and hide themselves, so a rule takes their place:
          without it the blocks would run together into the flat list this
          replaced.
        */}
        {groups.map((group, index) => (
          <SidebarGroup key={group.title ?? "inicio"} className="py-1">
            {index > 0 && (
              <div
                aria-hidden
                className="mx-2 mb-2 hidden h-px bg-sidebar-border group-data-[collapsible=icon]:block"
              />
            )}
            {/* Folded, the label is pulled up over the block before it and
                made transparent — still a box, and still on top. It took the
                clicks and the tooltip of a strip of the last icon above, so
                folded it lets them through. */}
            {group.title && (
              <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
                {group.title}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="gap-1" aria-label={group.title ?? undefined}>
                {group.items.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    location.pathname.startsWith(item.path + "/");
                  return (
                    <SidebarMenuItem key={item.path}>
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
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              {/* The same button as every other entry, not one drawn by hand:
                  folded to icons it becomes the 32px square the avatar fills,
                  and clips the name and the chevron instead of spilling them. */}
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
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
                </SidebarMenuButton>
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
                {/* The one entry that does not close the menu: the whole
                    screen changes under it, so the way back is the same click
                    again rather than a trip to reopen it. The switch is only
                    the picture of the state — hidden from assistive tech and
                    out of the tab order — because the entry itself is the
                    control, and says so with its role. */}
                <DropdownMenuItem
                  role="menuitemcheckbox"
                  aria-checked={resolvedTheme === "dark"}
                  onSelect={(event) => {
                    event.preventDefault();
                    setTheme(resolvedTheme === "dark" ? "light" : "dark");
                  }}
                >
                  <Moon className="mr-2" />
                  Tema oscuro
                  <Switch
                    checked={resolvedTheme === "dark"}
                    tabIndex={-1}
                    aria-hidden
                    className="pointer-events-none ml-auto"
                  />
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
    </Sidebar>
  );
};
