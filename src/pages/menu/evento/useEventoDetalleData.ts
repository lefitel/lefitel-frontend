import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { SesionContext } from "../../../context/SesionContext";
import { searchEvento } from "../../../api/Evento.api";
import { getRevicion } from "../../../api/Revicion.api";
import { getSolucion_evento } from "../../../api/Solucion.api";
import { getEventoObs } from "../../../api/EventoObs.api";
import { EventoInterface, EventoObsInterface, RevicionInterface, SolucionInterface } from "../../../interfaces/interfaces";

export function useEventoDetalleData(id: number) {
    const { sesion } = useContext(SesionContext);

    const [loading, setLoading]   = useState(true);
    const [evento, setEvento]     = useState<EventoInterface | null>(null);
    const [revicions, setRevicions] = useState<RevicionInterface[]>([]);
    const [solucion, setSolucion] = useState<SolucionInterface | null>(null);
    const [eventoObs, setEventoObs] = useState<EventoObsInterface[]>([]);

    const load = useCallback(() => {
        if (!id) return;
        setLoading(true);
        Promise.all([
            searchEvento(id, sesion.token),
            getRevicion(id, sesion.token),
            getSolucion_evento(id, sesion.token).catch(() => null),
            getEventoObs(id, sesion.token),
        ])
            .then(([ev, revs, sol, obs]) => {
                setEvento(ev);
                setRevicions(revs);
                setSolucion(sol);
                setEventoObs(obs);
            })
            .catch(() => toast.error("Error al cargar el evento"))
            .finally(() => setLoading(false));
    }, [id, sesion.token]);

    useEffect(() => { load(); }, [load]);

    return { evento, revicions, solucion, eventoObs, loading, load };
}
