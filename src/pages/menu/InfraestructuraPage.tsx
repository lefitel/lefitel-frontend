/**
 * The infrastructure diagram, in development only.
 *
 * **What keeps it out of production, and why it is two guards rather than
 * one.** The route in `App.tsx` and the menu entry in `AppSidebar.tsx` are
 * both wrapped in `import.meta.env.DEV`. Vite replaces that constant with the
 * literal `false` when it builds, so Rollup drops both branches and neither
 * the address nor the button exists in what Vercel serves. Hiding only the
 * button would leave the route reachable by typing it.
 *
 * **The document is deliberately not in `public/`.** Everything under
 * `public/` is copied verbatim into `dist/` and published whether or not
 * anything links to it, so a diagram of the servers, the mail providers and
 * the storage paths would be one guessed address away from anybody on the
 * internet. It lives in `web/dev/` instead, which Vite's dev server serves as
 * an ordinary static file and `vite build` never looks at.
 *
 * **It is a snapshot, not a reading.** Nothing here queries the running
 * system: the picture is as true as the day it was generated.
 * `web/dev/arquitectura-osefi.json` is its source — the diagram is rebuilt
 * from it with Archify, and `web/dev/README.md` has the command.
 */
const DIAGRAM_URL = "/dev/arquitectura-osefi.html";

const InfraestructuraPage = () => (
  <div className="flex flex-1 flex-col min-h-0 w-full gap-4 pt-4 px-6 md:px-8 pb-6 md:pb-8 animate-in fade-in duration-500">
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Infraestructura</h1>
      <p className="text-muted-foreground">
        Cómo está montado el sistema, de punta a punta. Esta pantalla solo existe en
        desarrollo, y el dibujo es una foto fija: hay que regenerarlo cuando cambie algo.
      </p>
    </div>

    {/* `flex-1 min-h-0` so it takes the room the header leaves, and a floor in
        `rem` so it never collapses to nothing on a short window — the diagram
        needs real height to stay readable, and `<main>` already scrolls.

        The frame carries its own light/dark switch and does not follow the
        app's: it is a self-contained document with its own viewer inside,
        which is the same property that lets it be opened straight from disk. */}
    <iframe
      src={DIAGRAM_URL}
      title="Diagrama de la infraestructura de Osefi"
      className="flex-1 min-h-[40rem] w-full rounded-lg border border-border bg-background"
    />
  </div>
);

export default InfraestructuraPage;
