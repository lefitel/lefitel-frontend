// The way into a report that already exists: the ones somebody saved, and the
// templates that come with the page.
//
// It was a panel in the configuration band, and the band is above the table
// now — so a third of that width went, on every screen and permanently, to a
// list that is read once at the start of a report and then never again. As a
// dropdown it costs one control on the strip, and the two panels that stayed
// went from a third of the width each to a half.
//
// A plain select could not have replaced that panel. It carried seven things a
// list of options cannot: three buttons per row behind three separate
// permissions, who owns a shared report, "showing 12 of 47" with its "load
// more", a loading state, a failure with Reintentar, and an empty state. Six of
// them survive here because this renders the very same components the panel
// did. The three buttons are the exception, and they are not lost: they moved
// beside the name of the open report, where they can also be used while it is
// open — which was never possible from the list.
//
// The search is the reason this is an improvement rather than a swap. With
// three saved reports a list on screen beats a dropdown, because you see all
// three without touching anything. With forty-seven it does not, and the panel
// had no way to search at all.

import { useMemo, useState } from "react";
import { ChevronsUpDownIcon, SearchIcon } from "lucide-react";
import type { CatalogRoot, ReportTemplate, SavedReport } from "../../../api/generador.api";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import SavedReports from "./SavedReports";
import TemplateGallery from "./TemplateGallery";

interface Props {
  reports: SavedReport[];
  /** How many exist in all, which is not how many are listed: one page arrives. */
  total?: number;
  onLoadMore?: () => void;
  templates: ReportTemplate[];
  roots: CatalogRoot[];
  current: SavedReport | null;
  currentUserId: number | undefined;
  onOpen: (report: SavedReport) => void;
  onPickTemplate: (template: ReportTemplate) => void;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h3 className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
    {children}
  </h3>
);

const ReportPicker = ({
  reports, total, onLoadMore, templates, roots, current, currentUserId,
  onOpen, onPickTemplate, loading, failed, onRetry,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const shownReports = useMemo(
    () => (q === "" ? reports : reports.filter((r) =>
      [r.name, r.description].some((t) => t?.toLowerCase().includes(q)))),
    [reports, q],
  );
  const shownTemplates = useMemo(
    () => (q === "" ? templates : templates.filter((t) =>
      [t.name, t.description].some((s) => s?.toLowerCase().includes(q)))),
    [templates, q],
  );

  // With no report open the control says what to do with it, not what is
  // missing. Somebody who has saved nothing yet is told where to start; the
  // panel this replaced said it in a whole empty state, and here it has to fit
  // in the control itself, because the control is all there is until it is
  // opened. Everybody else is asked to pick one — it read "Ningún reporte
  // abierto", a statement with nothing to do in it, which mattered more once
  // the control moved to the app's header and lost the label over it.
  const label = current?.name
    ?? (reports.length === 0 && templates.length > 0
      ? "Empiece por una plantilla"
      : "Seleccione un reporte");

  const nothingMatched = q !== "" && shownReports.length === 0 && shownTemplates.length === 0;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Cleared on the way in, not on the way out: clearing on close makes the
        // list jump back to its full length while the popover is still fading.
        if (next) setQuery("");
      }}
    >
      <PopoverTrigger
        // The name of the report is the text, so on its own the accessible
        // name would be whatever was opened last and nothing could refer to
        // the control itself. With a report open the label names the control
        // and carries the report after it. With none open the text is an
        // instruction, and it is announced as that: "Reporte abierto:
        // Seleccione un reporte" would name a report that does not exist.
        aria-label={current ? `Reporte abierto: ${label}` : label}
        // A pill, like the level of detail beside it. Neither is a field being
        // filled in: one states what a row of the report is, the other names
        // the report. Capped rather than sized, because a report's name is
        // whatever somebody typed and a long one would push everything else
        // off the header.
        className="flex h-8 min-w-0 max-w-[18rem] items-center justify-between gap-2 rounded-full border border-transparent bg-muted px-3 text-sm font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring"
      >
        <span className={`truncate ${current ? "" : "text-muted-foreground"}`}>{label}</span>
        <ChevronsUpDownIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[26rem] p-0">
        <div className="flex items-center gap-2 border-b px-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar un reporte"
            placeholder="Buscar entre sus reportes y las plantillas"
            className="h-9 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
          />
        </div>

        <div className="max-h-[26rem] space-y-3 overflow-y-auto p-3">
          {nothingMatched && (
            <p className="px-1 py-6 text-center text-sm text-muted-foreground">
              Nada coincide con «{query}».
            </p>
          )}

          {/*
            While a search is on, the section disappears rather than showing its
            empty state: "todavía no hay reportes guardados" is a statement about
            the account, and somebody with forty of them who typed three letters
            would be told they had never saved one.
          */}
          {(q === "" || shownReports.length > 0) && (
            <section className="space-y-1.5">
              <Heading>Guardados</Heading>
              <SavedReports
                reports={shownReports}
                // The footer counts the whole list, and while a search is on
                // that is the wrong thing to count: "mostrando 3 de 47" beside
                // three matches reads as forty-four more matches waiting, and
                // "cargar más" would fetch reports the search never asked for.
                total={q === "" ? total : shownReports.length}
                onLoadMore={q === "" ? onLoadMore : undefined}
                currentId={current?.id ?? null}
                currentUserId={currentUserId}
                onOpen={(report) => { setOpen(false); onOpen(report); }}
                loading={loading}
                failed={failed}
                onRetry={onRetry}
              />
            </section>
          )}

          {templates.length > 0 && (q === "" || shownTemplates.length > 0) && (
            <section className="space-y-1.5">
              <Heading>Plantillas</Heading>
              <TemplateGallery
                templates={shownTemplates}
                roots={roots}
                onPick={(template) => { setOpen(false); onPickTemplate(template); }}
              />
            </section>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ReportPicker;
