import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import AdssSec from "./AdssSec";
import MaterialSec from "./MaterialSec";
import ObsSec from "./ObsSec";
import PropietarioSec from "./PropiedadSec";
import TipoObsSec from "./TipoObsSec";

type Tab = "material" | "propietario" | "adss" | "tipoobs" | "obs";
export type InnerTab = "activos" | "archivados";

const TABS: { value: Tab; label: string }[] = [
  { value: "material", label: "Materiales" },
  { value: "propietario", label: "Propietarios" },
  { value: "adss", label: "ADSS" },
  { value: "tipoobs", label: "Tipos de obs." },
  { value: "obs", label: "Observaciones" },
];

const ParametrosPage = () => {
  const [tab, setTab] = useState<Tab>("material");
  const [innerTab, setInnerTab] = useState<InnerTab>("activos");

  const handleTabChange = (v: string) => {
    setTab(v as Tab);
    setInnerTab("activos");
  };

  return (
    <div className="@container/card p-6 md:p-8 w-full space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Parámetros</h1>
        <p className="text-sm text-muted-foreground mt-1">Gestión de catálogos del sistema</p>
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <div className="flex items-center justify-between gap-4">

          {/* Mobile: select */}
          <Select value={tab} onValueChange={(v) => v && handleTabChange(v)}>
            <SelectTrigger className="sm:hidden w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Desktop: tabs */}
          <TabsList className="hidden sm:flex">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <Tabs value={innerTab} onValueChange={(v) => setInnerTab(v as InnerTab)}>
            <TabsList>
              <TabsTrigger value="activos">Activos</TabsTrigger>
              <TabsTrigger value="archivados">Archivados</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="material">    <MaterialSec innerTab={innerTab} /></TabsContent>
        <TabsContent value="propietario"><PropietarioSec innerTab={innerTab} /></TabsContent>
        <TabsContent value="adss">       <AdssSec innerTab={innerTab} /></TabsContent>
        <TabsContent value="tipoobs">    <TipoObsSec innerTab={innerTab} /></TabsContent>
        <TabsContent value="obs">        <ObsSec innerTab={innerTab} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ParametrosPage;
