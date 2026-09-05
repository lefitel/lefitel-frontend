import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getTiemposResumen, TiempoTramoRow } from "../../../api/reporte.api";
import { mensajeDeError } from "../../../api/descarga";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DatePicker } from "../../../components/ui/date-picker";
import { Label } from "../../../components/ui/label";
import { ChevronRightIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

// Bandas fijadas por Isaias sobre la cifra real: la mediana de la red es de 31
// días. Con las viejas (1 y 7) todo salía rojo y el color dejaba de informar.
export const diasColor = (d: number) =>
  d <= 15 ? "text-green-600" : d <= 45 ? "text-amber-600" : "text-red-600";

/**
 * Aviso de los eventos que quedaron fuera del promedio. Un panel que descarta
 * filas en silencio miente por omisión, así que dice cuántas y por qué.
 */
export const textoDescartados = (n: number): string | null => {
  if (n <= 0) return null;
  const plural = n === 1 ? "evento quedó" : "eventos quedaron";
  return `${n} ${plural} fuera del promedio: su reparación está fechada antes que la avería, así que no se puede saber cuánto tardó.`;
};

const ReportTiemposSec = () => {
  const navigate = useNavigate();
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  const [tramos, setTramos]           = useState<TiempoTramoRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [generated, setGenerated]     = useState(false);
  const [descartados, setDescartados] = useState(0);

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");
    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaFin);    fin.setHours(23, 59, 59, 0);
    setLoading(true);
    try {
      const data = await getTiemposResumen({ fechaInicial: inicio, fechaFinal: fin });
      setTramos(data.tramos);
      setDescartados(data.descartados);
      setGenerated(true);
      if (data.tramos.length === 0) toast.warning("No hay eventos reparados en el período");
      else toast.success(`${data.tramos.length} tramos con eventos reparados`);
    } catch (error) {
      // The server's sentence when there is one (B3: 429 after thirty a
      // minute, shared with the generator), and the previous rows go with the
      // failure — see `ReportEstadoRedSec`.
      toast.error(mensajeDeError(error, "Error al generar el reporte"));
      setTramos([]);
      setDescartados(0);
      setGenerated(false);
    } finally {
      setLoading(false);
    }
  };

  const totalEventos = tramos.reduce((s, t) => s + t.count, 0);
  const avgGlobal = tramos.length > 0
    ? Math.round(tramos.reduce((s, t) => s + t.avgDias * t.count, 0) / totalEventos)
    : null;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Tiempos de Reparación</CardTitle>
          <CardDescription>
            Días que pasaron desde que ocurrió cada avería hasta que se reparó, en promedio por tramo. Entran los eventos <strong>reparados</strong> dentro del período elegido. Verde ≤15d, ámbar ≤45d, rojo &gt;45d.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            <div className="space-y-1.5 min-w-36">
              <Label>Fecha de inicio</Label>
              <DatePicker value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
            </div>
            <div className="space-y-1.5 min-w-36">
              <Label>Fecha de fin</Label>
              <DatePicker value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button onClick={handleGenerar} disabled={loading}>
              {loading && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Generar
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && !loading && (
        tramos.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No hay eventos reparados en el período seleccionado</p>
            {textoDescartados(descartados) && (
              <p className="text-xs text-muted-foreground">{textoDescartados(descartados)}</p>
            )}
          </div>
        ) : (
          <Card className="shadow-sm border-muted/60">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Promedio por tramo</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{totalEventos} eventos reparados</Badge>
                  {avgGlobal !== null && (
                    <Badge variant="outline" className={diasColor(avgGlobal)}>
                      Promedio global: {avgGlobal}d
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {textoDescartados(descartados) && (
                <p className="text-xs text-muted-foreground mb-3">{textoDescartados(descartados)}</p>
              )}
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>Tramo</TableHead>
                      <TableHead className="text-right">Eventos</TableHead>
                      <TableHead className="text-right">Promedio</TableHead>
                      <TableHead className="text-right">Mínimo</TableHead>
                      <TableHead className="text-right">Máximo</TableHead>
                      <TableHead className="text-right">Visitas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tramos.map((t) => (
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
                        <TableCell className="text-right text-xs text-muted-foreground">{t.count}</TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-semibold ${diasColor(t.avgDias)}`}>{t.avgDias}d</span>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{t.minDias}d</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{t.maxDias}d</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{t.avgVisitas}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
};

export default ReportTiemposSec;
