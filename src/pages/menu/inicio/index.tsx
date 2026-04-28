import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { ArrowUpRightIcon, BarChart3Icon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { SesionContext } from "../../../context/SesionContext";
import { can } from "../../../lib/permissions";
import AddEventoPageSheet from "../../../components/dialogs/add/AddEventoPageSheet";
import EditPosteSheet from "../../../components/dialogs/edits/EditPosteSheet";
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
    <div className="@container/card p-6 md:p-8 w-full space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Resumen operativo de postes y eventos en el sistema.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <Button variant="outline" onClick={() => navigate("/reportes")} className="gap-2">
            <BarChart3Icon className="h-4 w-4" />
            <span>Ver Reportes</span>
            <ArrowUpRightIcon className="h-3 w-3 opacity-50" />
          </Button>
          {can(rol, "eventos", "crear") && (
            <Button onClick={() => setOpenAddEvento(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
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

      <AlertBanner alerts={d.criticalAlerts} loading={d.loading} />

      <KpiCards kpis={d.kpis} loading={d.loading} period={d.period} setPeriod={d.setPeriod} showTrend={d.showTrend} />

      <ActivityChart chartData={d.chartData} loading={d.loading} xAxisLabel={d.xAxisLabel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OperationsMap
          mapMarkers={d.mapMarkers}
          mapTab={d.mapTab}
          setMapTab={d.setMapTab}
          token={d.token}
          load={d.load}
          setOpenEditPoste={d.setOpenEditPoste}
          setDataPoste={d.setDataPoste}
        />
        <UrgentEventsCard
          urgentEvents={d.urgentEvents}
          loading={d.loading}
        />
      </div>

      <TopPostesCard topPostes={d.topPostes} loading={d.loading} />

      {/* Dialogs */}
      <PermissionGuard module="eventos" action="crear" open={openAddEvento} onOpenChange={setOpenAddEvento}>
        <AddEventoPageSheet onSuccess={d.load} open={openAddEvento} setOpen={setOpenAddEvento} />
      </PermissionGuard>
      {d.dataPoste.id != null && (
        <PermissionGuard module="postes" action="editar" open={d.openEditPoste} onOpenChange={d.setOpenEditPoste}>
          <EditPosteSheet functionApp={d.load} poste={d.dataPoste} setPoste={d.setDataPoste} open={d.openEditPoste} setOpen={d.setOpenEditPoste} />
        </PermissionGuard>
      )}
    </div>
  );
};

export default InicioPage;
