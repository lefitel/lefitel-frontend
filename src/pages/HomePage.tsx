import { Fragment, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
import { pillThumb, pillTrack } from "../components/ui/tabs";
import { AppSidebar } from "../components/AppSidebar";
import { HeaderSlotProvider } from "../components/headerSlotContext";
import { TrailLabelProvider, type TrailLabel } from "../components/TrailLabel";
import { MENU_ITEMS } from "../components/menuItems";
import { ChevronRightIcon } from "lucide-react";
import { useScrollFade } from "../hooks/useScrollFade";

const ALL_ROUTES: { path: string; text: string }[] = [
  ...MENU_ITEMS,
  { path: "/app/perfil", text: "Perfil" },
  { path: "/app/novedades", text: "Novedades" },
];

const CHILD_LABELS: Record<string, (id: string) => string> = {
  postes: (id) => `Poste #${id}`,
  tramos: (id) => `Tramo #${id}`,
};

/**
 * Addresses under a screen that are another view of it, not a step down.
 * `tramos/archivados` is the archived half of the Tramos screen: the trail
 * stays on «Tramos» for both, and the Activos/Archivados pair beside it says
 * which.
 */
const SAME_STEP: Record<string, readonly string[]> = {
  tramos: ["archivados"],
};

// One segment of the trail, link or current page alike. Full height, where
// the tabs take a pixel off: an odd pixel cannot be split, so it all lands
// under the pill and the trail reads as pushed against the top.
const CRUMB =
  "relative inline-flex h-full items-center rounded-full border border-transparent px-3 font-medium whitespace-nowrap";

function buildBreadcrumbs(pathname: string): { label: string; path?: string }[] {
  // Strip the /app prefix and work with the remaining segments
  const segments = pathname.replace(/^\/app\/?/, "").split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Inicio" }];

  const topRoute = ALL_ROUTES.find((r) => r.path === `/app/${segments[0]}`);
  const topLabel = topRoute?.text ?? "Inicio";

  if (segments.length === 1 || SAME_STEP[segments[0]]?.includes(segments[1])) return [{ label: topLabel }];

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
  // What the open screen calls the record it is showing, when it has said so:
  // the address only knows its number. Kept with the address it was said for,
  // so a name is never drawn over another screen's step. See `useTrailLabel`.
  const [nombre, setNombre] = useState<TrailLabel | null>(null);
  const breadcrumbs = useMemo(() => {
    const migas = buildBreadcrumbs(location.pathname);
    // Only a step under a screen is a record with a name of its own.
    if (migas.length < 2 || nombre?.path !== location.pathname) return migas;
    return [...migas.slice(0, -1), { ...migas[migas.length - 1], label: nombre.text }];
  }, [location.pathname, nombre]);
  // State, not refs: the screens have to render again once they exist. Two
  // places for the open screen, one on each side of the trail; see `HeaderSlot`.
  const [slotInicio, setSlotInicio] = useState<HTMLDivElement | null>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const slots = useMemo(() => ({ start: slotInicio, end: slot }), [slotInicio, slot]);

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
            {/* `group/header` is what lets the trail below ask about its
                sibling, the slot. */}
            <div className="group/header flex items-center gap-2 p-2 w-full">
              <SidebarTrigger />
              {/* The open screen's way back, when it has one: left of the
                  trail, so it reads as part of it. Collapsed while empty, or
                  the row's gap would be counted twice. Deliberately without
                  `data-header-slot`: it must not make the trail give way on a
                  phone, where it is then the only way back there is. */}
              <div ref={setSlotInicio} className="flex shrink-0 items-center empty:hidden" />
              {/* The app's tab skin, as on the routed tabs of Tramos: the page
                  you are on is the raised pill, the way up is a link in the
                  track. `h-8`, not the tabs' `h-9`: with the header's padding
                  that is the 48px the folded header is pinned to. */}
              <nav
                aria-label="Miga de pan"
                className={cn(
                  // On a phone a sheet's name is what gives way, cut short,
                  // instead of the trail running past the edge of the header.
                  // There it never shares the row with the slot (below). From
                  // `sm` up it does, and it holds its width: the slot is the
                  // one that scrolls.
                  "inline-flex h-8 min-w-0 shrink-0 items-center p-0.5 text-sm max-sm:shrink",
                  // On a phone the row is some 300px once the trigger is taken
                  // off, and the trail does not shrink: beside it not even two
                  // tabs fit. So below `sm` it gives way whenever the open
                  // screen has hung something in the slot, and stays when the
                  // slot is empty — the dashboard and every detail sheet, where
                  // it is also the way back. From `sm` up both fit and nothing
                  // changes. A rule rather than state: the slot is filled
                  // through a portal, and its being empty or not is something
                  // only the document knows without being told.
                  "max-sm:group-has-[[data-header-slot]:not(:empty)]/header:hidden",
                  pillTrack,
                )}
              >
                {breadcrumbs.map((crumb, i) => (
                  <Fragment key={i}>
                    {i > 0 && (
                      <ChevronRightIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground/60" />
                    )}
                    {crumb.path ? (
                      <Link
                        to={crumb.path}
                        className={cn(
                          CRUMB,
                          "shrink-0 text-foreground/60 transition-colors hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
                        )}
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span aria-current="page" className={cn(CRUMB, "min-w-0 text-foreground")}>
                        <span className={pillThumb} />
                        {/* A record's own name can be long; the address's number never was. */}
                        <span className="relative z-10 min-w-0 max-w-40 truncate sm:max-w-56">{crumb.label}</span>
                      </span>
                    )}
                  </Fragment>
                ))}
              </nav>
              {/* Whatever the open screen hangs up here; see `HeaderSlot`.
                  Narrower than its contents — a phone, mostly — it scrolls
                  sideways rather than wrapping into a second row the header
                  has no height for. The padding is room for focus rings,
                  which a scrolling box would otherwise clip, and the negative
                  margins give that room back. */}
              {/* `data-header-slot` is what the trail's rule looks for, and the
                  element must stay literally empty until a screen fills it:
                  `:empty` is false for so much as a space. `ml-auto` at every
                  width: the controls are at the right edge with the trail or
                  without it, so they are where they were last time. */}
              <div
                ref={setSlot}
                data-header-slot=""
                className="no-scrollbar -my-1 -mr-1 ml-auto flex min-w-0 items-center gap-2 overflow-x-auto p-1"
              />
            </div>
          </header>
          <main ref={scroller} className="flex flex-1 flex-col min-h-0 overflow-auto">
            <HeaderSlotProvider value={slots}>
              <TrailLabelProvider value={setNombre}>
                <Outlet />
              </TrailLabelProvider>
            </HeaderSlotProvider>
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
