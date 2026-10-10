import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { ArrowUpRightIcon, BarChart3Icon, CloudOffIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import EventoSheet from "../../../components/dialogs/upsert/EventoSheet";
import PosteSheet from "../../../components/dialogs/upsert/PosteSheet";
import PermissionGuard from "../../../components/PermissionGuard";
import { useInicioData } from "./useInicioData";
import { KpiCards } from "./KpiCards";
import { ActivityChart } from "./ActivityChart";
import { OperationsMap } from "./OperationsMap";
import { UrgentEventsCard } from "./UrgentEventsCard";
import { TopPostesCard } from "./TopPostesCard";
import { AlertBanner } from "./AlertBanner";

const InicioPage = () => {
  const navigate = useNavigate();
  const { sesion } = useContext(SesionContext);
  const rol = sesion.usuario.id_rol;
  const [openAddEvento, setOpenAddEvento] = useState(false);
  const d = useInicioData();

  return (
    <div className="@container/card p-page w-full space-y-page animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Resumen operativo de postes y eventos en el sistema.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {/* Only to somebody who may open it. Without `reportes.ver` the
              press went to a route that sent them straight back here, and
              nothing visible happened. */}
          {can(rol, "reportes", "ver") && (
            <Button variant="outline" onClick={() => navigate("/app/reportes")} className="gap-2">
              <BarChart3Icon className="h-4 w-4" />
              <span>Ver informes</span>
              <ArrowUpRightIcon className="h-3 w-3 opacity-50" />
            </Button>
          )}
          {can(rol, "eventos", "crear") && (
            <Button onClick={() => setOpenAddEvento(true)} className="gap-2">
              <PlusIcon className="h-4 w-4" />
              <span>Registrar Evento</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={d.load}
            disabled={d.loading}
            className="h-8 w-8"
            title="Actualizar datos"
            aria-label="Actualizar datos"
          >
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/*
        A failed load is not an empty dashboard.
        Every card below reads `kpis?.x ?? 0`, so without this branch an outage
        rendered "0 postes · 0 pendientes", "No hay incidencias pendientes" and
        an empty map: the failure state drawn exactly like a system in perfect
        health, behind a toast that clears itself after four seconds. Somebody
        could walk away believing the backlog was empty.
      */}
      {d.error && !d.loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="p-3 bg-destructive/10 rounded-full">
            <CloudOffIcon className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <p className="font-medium">No se pudieron cargar los datos</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              No hay conexión con el servidor, así que no podemos decirte cómo está la red.
              Las cifras de esta pantalla no son cero: es que no las tenemos.
            </p>
          </div>
          <Button onClick={d.load} disabled={d.loading} className="gap-2 mt-1">
            <RefreshCwIcon className={`h-4 w-4 ${d.loading ? "animate-spin" : ""}`} />
            Volver a intentar
          </Button>
        </div>
      ) : (
      <>
      <AlertBanner alerts={d.criticalAlerts} loading={d.loading} />

      <KpiCards kpis={d.kpis} loading={d.loading} period={d.period} setPeriod={d.setPeriod} showTrend={d.showTrend} setCustomRange={d.setCustomRange} currentDateRange={d.currentDateRange} />

      <ActivityChart chartData={d.chartData} loading={d.loading} xAxisLabel={d.xAxisLabel} period={d.period} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OperationsMap
          mapMarkers={d.mapMarkers}
          mapTab={d.mapTab}
          setMapTab={d.setMapTab}
          load={d.load}
          setOpenEditPoste={d.setOpenEditPoste}
          setDataPoste={d.setDataPoste}
        />
        <UrgentEventsCard
          urgentEvents={d.urgentEvents}
          criticalObsEvents={d.criticalObsEvents}
          loading={d.loading}
        />
      </div>

      <TopPostesCard topPostes={d.topPostes} loading={d.loading} />
      </>
      )}

      {/* Dialogs */}
      <PermissionGuard module="eventos" action="crear" open={openAddEvento} onOpenChange={setOpenAddEvento}>
        <EventoSheet onSuccess={d.load} open={openAddEvento} setOpen={setOpenAddEvento} />
      </PermissionGuard>
      {d.dataPoste.id != null && (
        <PermissionGuard module="postes" action="editar" open={d.openEditPoste} onOpenChange={d.setOpenEditPoste}>
          <PosteSheet poste={d.dataPoste} open={d.openEditPoste} setOpen={d.setOpenEditPoste} onSuccess={d.load} />
        </PermissionGuard>
      )}
    </div>
  );
};

export default InicioPage;
