import { useMemo } from "react";
import { EventoInterface, PosteInterface } from "../../../../interfaces/interfaces";
import { Card, CardContent } from "../../../../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs";
import { ActivityIcon, AlertTriangleIcon, MapIcon } from "lucide-react";
import PosteDetalleEventosAbiertos, { EventoActionHandlers } from "./PosteDetalleEventosAbiertos";
import PosteDetalleVecinos from "./PosteDetalleVecinos";
import BitacoraPanel from "../../../../components/BitacoraPanel";

interface Props {
  loading: boolean;
  poste: PosteInterface | null;
  eventos: EventoInterface[];
  tramoPostes: PosteInterface[];
  canEditEventos: boolean;
  canCreateEventos: boolean;
  onNuevoEvento: () => void;
  onVerPoste: (id: number) => void;
  actions: EventoActionHandlers;
}

export default function PosteDetalleHistorial({
  loading, poste, eventos, tramoPostes,
  canEditEventos, canCreateEventos,
  onNuevoEvento, onVerPoste, actions,
}: Props) {
  const abiertosCount = useMemo(() => eventos.filter((e) => !e.state).length, [eventos]);
  const vecinosCount = useMemo(
    () => Math.max(0, tramoPostes.filter((p) => p.id !== poste?.id).length),
    [tramoPostes, poste?.id]
  );

  return (
    <Card className="shadow-sm border-muted/60 py-0">
      <CardContent className="p-0">
        <Tabs defaultValue="abiertos" className="gap-0">
          <div className="px-4 pt-4 pb-3 border-b border-border/40 flex items-center justify-between gap-3 flex-wrap">
            <TabsList variant="line">
              <TabsTrigger value="abiertos" className="gap-1.5">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                Eventos abiertos
                {abiertosCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                    {abiertosCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="vecinos" className="gap-1.5">
                <MapIcon className="h-3.5 w-3.5" />
                Vecinos del tramo
                {vecinosCount > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    ({vecinosCount})
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="bitacora" className="gap-1.5">
                <ActivityIcon className="h-3.5 w-3.5" />
                Bitácora
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="abiertos" className="p-4">
            <PosteDetalleEventosAbiertos
              loading={loading}
              eventos={eventos}
              canEditEventos={canEditEventos}
              canCreateEventos={canCreateEventos}
              onNuevoEvento={onNuevoEvento}
              actions={actions}
            />
          </TabsContent>

          <TabsContent value="vecinos" className="p-4">
            <PosteDetalleVecinos
              loading={loading}
              postes={tramoPostes}
              posteActualId={poste?.id}
              onVerPoste={onVerPoste}
            />
          </TabsContent>

          <TabsContent value="bitacora" className="p-5">
            <BitacoraPanel entity="Poste" entityId={poste?.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
