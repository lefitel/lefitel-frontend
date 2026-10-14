import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { HeaderSlot } from "../../../components/HeaderSlot";
import { useIsWiderThan } from "../../../hooks/useIsWiderThan";
import ReportGeneralSec from "./ReportGeneralSec";
import ReportTramoSec from "./ReportTramoSec";
import ReportRecorridoSec from "./ReportRecorrido";
import ReportEstadoRedSec from "./ReportEstadoRedSec";
import ReportObsFrecuenciaSec from "./ReportObsFrecuenciaSec";
import ReportTiemposSec from "./ReportTiemposSec";

type Tab = "general" | "tramo" | "recorrido" | "estado" | "observaciones" | "tiempos";

const TABS: { value: Tab; label: string }[] = [
  { value: "general",       label: "General" },
  { value: "tramo",         label: "Por Tramo" },
  { value: "recorrido",     label: "Recorrido" },
  { value: "estado",        label: "Estado de la Red" },
  { value: "observaciones", label: "Observaciones" },
  { value: "tiempos",       label: "Tiempos" },
];

/**
 * How wide the screen has to be for the six tabs to fit in the app's header.
 *
 * The tabs take some 610px and what they share the row with — the sidebar
 * trigger, the trail, the gaps — some 240. Reckoned from the class names, not
 * measured on a screen; it is the one number to move if the header looks
 * crowded just above it or wastefully empty just below.
 */
export const REPORT_TABS_MIN_WIDTH = 880;

const ReportePage = () => {
  const [tab, setTab] = useState<Tab>("general");
  // The screen's own width, which is the header's: the two share a column. Not
  // the window's — the sidebar takes 13rem from both without the viewport
  // changing, and that alone is enough to cross the line.
  const [pageRef, tabsFit] = useIsWiderThan<HTMLDivElement>(REPORT_TABS_MIN_WIDTH);

  return (
    <div ref={pageRef} className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
      <h1 className="sr-only">Informes</h1>

      {/* Which report is open is chosen in the header, like every other
          screen's page-level choice. Tabs where there is room: all six in
          sight and one click each. A select where there is not, rather than
          tabs that scroll sideways under the trail. One or the other, never
          both, and both drive the same state, so crossing the line keeps the
          report that was open. */}
      <HeaderSlot>
        {tabsFit ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="shrink-0">
            <TabsList size="sm" aria-label="Informe">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : (
          <Select value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <SelectTrigger aria-label="Informe" className="h-8 w-auto shrink-0 gap-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {TABS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </HeaderSlot>

      {/* Content — shared */}
      {tab === "general"       && <ReportGeneralSec />}
      {tab === "tramo"         && <ReportTramoSec />}
      {tab === "recorrido"     && <ReportRecorridoSec />}
      {tab === "estado"        && <ReportEstadoRedSec />}
      {tab === "observaciones" && <ReportObsFrecuenciaSec />}
      {tab === "tiempos"       && <ReportTiemposSec />}
    </div>
  );
};

export default ReportePage;
