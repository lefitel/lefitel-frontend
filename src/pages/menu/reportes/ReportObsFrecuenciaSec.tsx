import { useContext, useMemo, useState } from "react";
import { SesionContext } from "../../../context/SesionContext";
import { getObsFrecuencia, ObsFrecuenciaRow } from "../../../api/reporte.api";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { DatePicker } from "../../../components/ui/date-picker";
import { Label } from "../../../components/ui/label";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { ChevronDownIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

const ReportObsFrecuenciaSec = () => {
  const { sesion } = useContext(SesionContext);
  const [fechaInicio, setFechaInicio] = useState<Date | undefined>(undefined);
  const [fechaFin, setFechaFin]       = useState<Date | undefined>(undefined);
  const [rows, setRows]               = useState<ObsFrecuenciaRow[]>([]);
  const [loading, setLoading]         = useState(false);
  const [generated, setGenerated]     = useState(false);
  const [tipoFiltro, setTipoFiltro]   = useState("all");

  const handleGenerar = async () => {
    if (!fechaInicio || !fechaFin) return toast.warning("Selecciona un rango de fechas");
    if (fechaInicio > fechaFin) return toast.warning("La fecha de inicio debe ser anterior a la fecha de fin");
    const inicio = new Date(fechaInicio); inicio.setHours(0, 0, 0, 0);
    const fin    = new Date(fechaFin);    fin.setHours(23, 59, 59, 0);
    setLoading(true);
    setTipoFiltro("all");
    try {
      const data = await getObsFrecuencia({ fechaInicial: inicio, fechaFinal: fin }, sesion.token);
      setRows(data);
      setGenerated(true);
      if (data.length === 0) toast.warning("Sin observaciones registradas en el período");
      else toast.success(`${data.length} tipos de observación encontrados`);
    } catch {
      toast.error("Error al generar el reporte");
    } finally {
      setLoading(false);
    }
  };

  // Tipos únicos derivados de los resultados
  const tiposUnicos = useMemo(() => [...new Set(rows.map((r) => r.tipoObs))].sort(), [rows]);

  // Filas filtradas por tipo seleccionado
  const rowsFiltradas = useMemo(
    () => tipoFiltro === "all" ? rows : rows.filter((r) => r.tipoObs === tipoFiltro),
    [rows, tipoFiltro]
  );

  const totalObs = rowsFiltradas.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border-muted/60">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle>Observaciones Frecuentes</CardTitle>
          <CardDescription>
            Ranking de observaciones registradas en eventos del período, ordenadas por frecuencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Fecha de inicio</Label>
              <DatePicker value={fechaInicio} onSelect={setFechaInicio} placeholder="Inicio" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de fin</Label>
              <DatePicker value={fechaFin} onSelect={setFechaFin} placeholder="Fin" />
            </div>
            <Button onClick={handleGenerar} disabled={loading} className="h-10 px-6">
              {loading && <Loader2Icon className="h-4 w-4 animate-spin mr-2" />}
              Generar
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && !loading && (
        rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin observaciones registradas en el período</p>
        ) : (
          <Card className="shadow-sm border-muted/60">
            <CardHeader className="border-b border-border/40 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex gap-2 flex-wrap items-center">
                  <CardTitle>Resultados</CardTitle>
                  <Badge variant="outline">{rowsFiltradas.length} observaciones</Badge>
                  <Badge variant="outline">{totalObs} ocurrencias</Badge>
                </div>
                {tiposUnicos.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tipo:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted transition-colors">
                        {tipoFiltro === "all" ? "Todos" : tipoFiltro}
                        <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
                        <DropdownMenuRadioGroup value={tipoFiltro} onValueChange={setTipoFiltro}>
                          <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                          {tiposUnicos.map((t) => (
                            <DropdownMenuRadioItem key={t} value={t}>{t}</DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted">
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observación</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="w-40">Frecuencia</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsFiltradas.map((r, i) => (
                      <TableRow key={`${r.tipoObs}-${r.obs}`}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.tipoObs}</TableCell>
                        <TableCell className="text-sm font-medium">{r.obs}</TableCell>
                        <TableCell className="text-right text-sm">{r.count}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-1.5">
                              <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${r.pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground w-8 text-right">{r.pct}%</span>
                          </div>
                        </TableCell>
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

export default ReportObsFrecuenciaSec;
