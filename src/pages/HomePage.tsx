import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { AppSidebar } from "../components/AppSidebar";
import { MENU_ITEMS } from "../components/menuItems";
import { Button } from "../components/ui/button";
import { ChevronRightIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../components/theme-provider";

const ALL_ROUTES: { path: string; text: string }[] = [
  ...MENU_ITEMS,
  { path: "/app/perfil", text: "Perfil" },
];

const CHILD_LABELS: Record<string, (id: string) => string> = {
  postes: (id) => `Poste #${id}`,
};

function buildBreadcrumbs(pathname: string): { label: string; path?: string }[] {
  // Strip the /app prefix and work with the remaining segments
  const segments = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Inicio" }];

  const topRoute = ALL_ROUTES.find((r) => r.path === `/app/${segments[0]}`);
  const topLabel = topRoute?.text ?? "Inicio";

  if (segments.length === 1) return [{ label: topLabel }];

  const childLabel = CHILD_LABELS[segments[0]]?.(segments[1]) ?? `#${segments[1]}`;
  return [
    { label: topLabel, path: `/app/${segments[0]}` },
    { label: childLabel },
  ];
}

const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const breadcrumbs = buildBreadcrumbs(location.pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-sidebar">
        <div className="bg-background overflow-hidden flex flex-col h-full sm:m-2 sm:rounded-xl sm:shadow-sm sm:border">
          <header className="border-b flex shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 p-2 w-full">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <nav className="flex items-center gap-1.5 text-sm">
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {i > 0 && <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                    {crumb.path ? (
                      <button
                        onClick={() => navigate(crumb.path!)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="font-medium text-foreground">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-8 w-8"
                >
                  {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </header>
          <main className="flex flex-1 flex-col overflow-auto">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default HomePage;
