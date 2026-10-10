import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { Separator } from "../components/ui/separator";
import { AppSidebar } from "../components/AppSidebar";
import { MENU_ITEMS } from "../components/menuItems";
import { Button } from "../components/ui/button";
import { ChevronRightIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "../components/theme-provider";
import { useScrollFade } from "../hooks/useScrollFade";

const ALL_ROUTES: { path: string; text: string }[] = [
  ...MENU_ITEMS,
  { path: "/app/perfil", text: "Perfil" },
  { path: "/app/novedades", text: "Novedades" },
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

/**
 * The shell is exactly one screen tall, and the content scrolls inside it.
 *
 * Every class below that touches height is load-bearing, so resist tidying
 * them away. The wrapper is pinned with `h-svh` (small viewport height, so a
 * phone's collapsing browser bar can't push the box past the fold); each
 * descendant then needs `min-h-0` to undo the flexbox default that refuses to
 * shrink a child below its content, and the card uses `flex-1` rather than
 * `h-full` so it subtracts its own `sm:m-2` margin instead of overflowing by
 * it. Remove any one of them and the chain of definite heights breaks: the
 * `overflow-auto` on <main> quietly stops meaning anything, the document
 * scrolls instead, and the header — which lives inside the box, not fixed to
 * the window — rides away with it. That was the old behaviour, and it also
 * left the `sticky` sub-headers on the detail pages permanently unstuck.
 */
const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const breadcrumbs = buildBreadcrumbs(location.pathname);

  // The gradient that softens the bottom edge; see the hook for why it is
  // tied to the scroll position instead of being always on.
  const { scroller, fade } = useScrollFade<HTMLElement, HTMLDivElement>(location.pathname);

  return (
    <SidebarProvider defaultOpen={false} className="h-svh overflow-hidden">
      <AppSidebar />
      <SidebarInset className="bg-sidebar h-full min-h-0">
        {/* The sidebar's own padding is already the gap: its entries sit 8px
            from the wall, and the card's margin on top of that left them 16px
            from the page. From `md` only — below it there is no sidebar
            beside the card, and the margin is all the gap there is. */}
        <div className="bg-background relative overflow-hidden flex flex-col flex-1 min-h-0 sm:m-2 md:ml-0 sm:rounded-xl sm:shadow-sm sm:border">
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
                  onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  className="h-8 w-8"
                >
                  {resolvedTheme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </header>
          <main ref={scroller} className="flex flex-1 flex-col min-h-0 overflow-auto">
            <Outlet />
          </main>
          {/* Sits outside <main> on purpose: inside, it would scroll away
              with the content it covers. Three stops rather than two, because
              a straight ramp shows a seam where the gradient starts, and `/0`
              rather than `transparent`, which Safari interpolates through
              grey. Starts hidden; the hook writes the real value on mount. */}
          <div
            ref={fade}
            aria-hidden
            style={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-background via-background/60 to-background/0"
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default HomePage;
