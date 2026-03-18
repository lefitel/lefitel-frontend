import { useState } from "react";
import { Button } from "../../../components/ui/button";
import ReportGeneralSec from "./ReportGeneralSec";
import ReportTramoSec from "./ReportTramoSec";
import ReportRecorridoSec from "./ReportRecorrido";

type Tab = "general" | "tramo" | "recorrido";

const TABS: { value: Tab; label: string }[] = [
  { value: "general", label: "General" },
  { value: "tramo", label: "Por Tramo" },
  { value: "recorrido", label: "Recorrido" },
];

const ReportePage = () => {
  const [tab, setTab] = useState<Tab>("general");

  return (
    <div className="@container/card  p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reportes</h1>
        <p className="text-muted-foreground">Generación y exportación de reportes del sistema.</p>
      </div>

      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1 gap-1 w-fit">
        {TABS.map((t) => (
          <Button
            key={t.value}
            variant={tab === t.value ? "default" : "ghost"}
            size="sm"
            className="h-8 text-sm"
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "general" && <ReportGeneralSec />}
      {tab === "tramo" && <ReportTramoSec />}
      {tab === "recorrido" && <ReportRecorridoSec />}
    </div>
  );
};

export default ReportePage;
