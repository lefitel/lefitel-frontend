import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
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

const ReportePage = () => {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="@container/card pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full space-y-3 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reportes</h1>
        <p className="text-muted-foreground">Generación y exportación de reportes del sistema.</p>
      </div>

      {/* Mobile: Select */}
      <div className="md:hidden">
        <Select value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: TabsList only */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="hidden md:flex">
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

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
