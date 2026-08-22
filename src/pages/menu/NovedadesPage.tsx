import { useEffect } from "react";
import { APP_VERSION, RELEASES, type ChangeKind } from "../../data/changelog";
import { markReleaseSeen } from "../../hooks/useSeenRelease";

/**
 * Same shape as the criticality badges elsewhere in the app
 * (`text-<c>-700 bg-<c>-500/15 border-<c>-500/40`), with a lighter text tone
 * added for dark mode, where the 700 weight those use is close to unreadable.
 */
const KINDS: Record<ChangeKind, { label: string; className: string }> = {
  nuevo: {
    label: "Nuevo",
    className: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/40",
  },
  mejora: {
    label: "Mejora",
    className: "text-blue-700 dark:text-blue-400 bg-blue-500/15 border-blue-500/40",
  },
  arreglo: {
    label: "Arreglo",
    className: "text-amber-700 dark:text-amber-400 bg-amber-500/15 border-amber-500/40",
  },
};

/**
 * `new Date("2026-08-22")` is parsed as UTC midnight, which prints as the day
 * before for anyone west of Greenwich — Bolivia included. Pinning the time
 * makes it a local date.
 */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const NovedadesPage = () => {
  // Opening the page is the whole of "read"; there is nothing to confirm.
  useEffect(markReleaseSeen, []);

  return (
    <div className="@container/card pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Novedades</h1>
        <p className="text-muted-foreground">
          Lo que ha cambiado en el sistema, versión a versión.
        </p>
      </div>

      {/* Full width, like every other screen. The room goes into structure
          rather than into longer lines: on a wide monitor the version and its
          date move out into their own column, so the notes stay a readable
          measure instead of running the length of the display. */}
      <div className="space-y-8">
        {RELEASES.map((release, index) => (
          <section
            key={release.version}
            className={`grid gap-x-10 gap-y-4 lg:grid-cols-[13rem_1fr] ${
              index > 0 ? "border-t border-border/40 pt-8" : ""
            }`}
          >
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 lg:flex-col lg:items-start lg:gap-y-1.5">
              <h2 className="text-lg font-semibold tabular-nums">Versión {release.version}</h2>
              {release.version === APP_VERSION && (
                <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Actual
                </span>
              )}
              <time
                dateTime={release.date}
                className="ml-auto text-sm text-muted-foreground lg:ml-0"
              >
                {longDate(release.date)}
              </time>
            </header>

            <ul className="space-y-3">
              {release.changes.map((change, i) => (
                <li key={i} className="flex flex-col gap-1.5 sm:flex-row sm:gap-3">
                  {/* Fixed width so the sentences line up in one column
                      instead of stepping in and out with the label. */}
                  <span
                    className={`inline-flex w-18 shrink-0 items-center justify-center self-start rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide sm:mt-1 ${KINDS[change.kind].className}`}
                  >
                    {KINDS[change.kind].label}
                  </span>
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {change.text}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

    </div>
  );
};

export default NovedadesPage;
