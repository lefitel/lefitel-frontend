import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SesionContext } from "../../../context/SesionContext";
import { getEstadoRed, EstadoRedRow } from "../../../api/reporte.api";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DatePicker } from "../../../components/ui/date-picker";
import { Label } from "../../../components/ui/label";
import { ChevronRightIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";

const saludColor = (pct: number) => {
  if (pct >= 80) return "text-green-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
};

const ReportEstadoRedSec = () => {
  const { sesion } = useContext(SesionContext);
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  const [tramos, setTramos]           = useState<EstadoRedRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [generated, setGenerated]     = useState(false);

  const handleGenerar = async () => {
    if (fechaInicio && fechaFin && fechaInicio > fechaFin)
      return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");

    setLoading(true);
    try {
      const filtro: { fechaInicial?: Date; fechaFinal?: Date } = {};
      if (fechaInicio && fechaFin) {
        const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
        const fin    = new Date(fechaFin);    fin.setHours(23, 59, 59, 0);
        filtro.fechaInicial = inicio;
        filtro.fechaFinal   = fin;
      }
      const data = await getEstadoRed(filtro, sesion.token);
      setTramos(data);
      setGenerated(true);
      if (data.length === 0) toast.warning("No hay tramos registrados");
      else toast.success(`${data.length} tramos cargados`);
    } catch {
      toast.error("Error al cargar el estado de la red");
    } finally {
      setLoading(false);
    }
  };

  const totalPostes         = tramos.reduce((s, t) => s + t.totalPostes, 0);
  const totalConPendientes  = tramos.reduce((s, t) => s + t.conPendientes, 0);
  const totalPendientes     = tramos.reduce((s, t) => s + t.totalPendientes, 0);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Estado de la Red</CardTitle>
          <CardDescription>
            Salud de cada tramo agrupada por ciudades. Muestra postes con eventos pendientes y porcentaje de salud. Sin fechas muestra el estado actual; con fechas filtra eventos con revisión en el período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <div className="space-y-1.5 min-w-36">
              <Label>Fecha de inicio <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <DatePicker value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
            </div>
            <div className="space-y-1.5 min-w-36">
              <Label>Fecha de fin <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <DatePicker value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button onClick={handleGenerar} disabled={loading}>
              {loading
                ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                : <RefreshCwIcon className="h-4 w-4 mr-2" />}
              {generated ? "Actualizar" : "Generar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && !loading && (
        <Card className="shadow-sm border-muted/60">
          <CardHeader className="border-b border-border/40 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle>Resultados</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{tramos.length} tramos</Badge>
                <Badge variant="outline">{totalPostes} postes</Badge>
                <Badge variant="outline" className="text-amber-600">{totalConPendientes} postes con pendientes</Badge>
                <Badge variant="outline" className="text-red-600">{totalPendientes} eventos pendientes</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>Tramo</TableHead>
                    <TableHead className="text-right">Postes</TableHead>
                    <TableHead className="text-right">Postes c/ pendientes</TableHead>
                    <TableHead className="text-right">Eventos pendientes</TableHead>
                    <TableHead className="text-right">Total eventos</TableHead>
                    <TableHead className="text-right">Salud</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tramos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Sin datos</TableCell>
                    </TableRow>
                  ) : tramos.map((t) => (
                    <TableRow key={`${t.ciudadAId}-${t.ciudadBId}`}>
                      <TableCell>
                        <span className="flex items-center gap-0.5 text-sm whitespace-nowrap">
                          {t.ciudadAId
                            ? <button className="hover:underline text-primary" onClick={() => navigate(`/app/ciudades/${t.ciudadAId}`)}>{t.ciudadAName}</button>
                            : <span>{t.ciudadAName}</span>}
                          <ChevronRightIcon className="h-3 w-3 mx-0.5 shrink-0 text-muted-foreground" />
                          {t.ciudadBId
                            ? <button className="hover:underline text-primary" onClick={() => navigate(`/app/ciudades/${t.ciudadBId}`)}>{t.ciudadBName}</button>
                            : <span>{t.ciudadBName}</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm">{t.totalPostes}</TableCell>
                      <TableCell className="text-right">
                        {t.conPendientes > 0
                          ? <Badge className="bg-amber-500/10 text-amber-600 border-transparent shadow-none text-xs">{t.conPendientes}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.totalPendientes > 0
                          ? <Badge className="bg-red-500/10 text-red-600 border-transparent shadow-none text-xs">{t.totalPendientes}</Badge>
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{t.totalEventos > 0 ? t.totalEventos : "—"}</TableCell>
                      <TableCell className="text-right">
                        <span className={cn("text-sm font-semibold", saludColor(t.pctSalud))}>{t.pctSalud}%</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReportEstadoRedSec;
