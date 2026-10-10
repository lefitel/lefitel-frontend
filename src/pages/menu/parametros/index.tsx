import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import AdssSec from "./AdssSec";
import MaterialSec from "./MaterialSec";
import ObsSec from "./ObsSec";
import PropietarioSec from "./PropiedadSec";
import TipoObsSec from "./TipoObsSec";
import type { RegistroEnlazado } from "./useRegistroEnlazado";

type Tab = "material" | "propietario" | "adss" | "tipoobs" | "obs";
export type InnerTab = "activos" | "archivados";

const TABS: { value: Tab; label: string }[] = [
  { value: "material", label: "Materiales" },
  { value: "propietario", label: "Propietarios" },
  { value: "adss", label: "ADSS" },
  { value: "tipoobs", label: "Tipos de obs." },
  { value: "obs", label: "Observaciones" },
];

const esTab = (v: string | null): v is Tab => TABS.some((t) => t.value === v);

const ParametrosPage = () => {
  // `?tab=material&id=5` is how the Bitácora links to a catalogue entry. The
  // tab is read once, on arrival, and decides which section is mounted; the
  // record is handed to that section, which owns the lists and can find it.
  const [parametros, setParametros] = useSearchParams();
  const tabPedida = parametros.get("tab");
  const idPedido = Number(parametros.get("id")) || null;

  const [tab, setTab] = useState<Tab>(() => (esTab(tabPedida) ? tabPedida : "material"));
  const [innerTab, setInnerTab] = useState<InnerTab>("activos");

  const enlace = useMemo<RegistroEnlazado | undefined>(() => {
    if (!idPedido || !esTab(tabPedida)) return undefined;
    return {
      id: idPedido,
      verArchivados: () => setInnerTab("archivados"),
      verActivos: () => setInnerTab("activos"),
      // Out of the address once answered. Left there, a reload would open the
      // form again, and so would coming back to this tab.
      atendido: () => setParametros(
        (actuales) => { actuales.delete("tab"); actuales.delete("id"); return actuales; },
        { replace: true },
      ),
    };
  }, [idPedido, tabPedida, setParametros]);
  /** Only the section the link names gets it. */
  const enlaceDe = (seccion: Tab) => (enlace && tabPedida === seccion ? enlace : undefined);

  const limpiarDireccion = () => setParametros(
    (actuales) => { actuales.delete("tab"); actuales.delete("id"); return actuales; },
    { replace: true },
  );

  // An address that names a tab and no record, or a record and no tab, has
  // nothing left to do once the tab is chosen. Left there it disagrees with the
  // screen after the first change of tab, and a reload jumps back.
  const sobraEnLaDireccion = !enlace && (tabPedida !== null || parametros.has("id"));
  useEffect(() => {
    if (sobraEnLaDireccion) limpiarDireccion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sobraEnLaDireccion]);

  const handleTabChange = (v: string) => {
    setTab(v as Tab);
    setInnerTab("activos");
    // Leaving the tab is leaving the link behind. A request still unanswered —
    // its list slow, or failed — would otherwise wait in the address and fire
    // on the way back to this tab, or after a reload from another one.
    if (tabPedida !== null || parametros.has("id")) limpiarDireccion();
  };

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">
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

        <TabsContent value="material">    <MaterialSec innerTab={innerTab} enlace={enlaceDe("material")} /></TabsContent>
        <TabsContent value="propietario"><PropietarioSec innerTab={innerTab} enlace={enlaceDe("propietario")} /></TabsContent>
        <TabsContent value="adss">       <AdssSec innerTab={innerTab} enlace={enlaceDe("adss")} /></TabsContent>
        <TabsContent value="tipoobs">    <TipoObsSec innerTab={innerTab} enlace={enlaceDe("tipoobs")} /></TabsContent>
        <TabsContent value="obs">        <ObsSec innerTab={innerTab} enlace={enlaceDe("obs")} /></TabsContent>
      </Tabs>
    </div>
  );
};

export default ParametrosPage;
