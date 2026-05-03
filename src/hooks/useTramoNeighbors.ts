import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getTramos } from "../api/Poste.api";

export const useTramoNeighbors = (token: string) => {
    const [neighbors, setNeighbors] = useState<Map<number, Set<number>>>(new Map());

    useEffect(() => {
        getTramos(token)
            .then((pairs) => {
                const map = new Map<number, Set<number>>();
                pairs.forEach(({ id_ciudadA, id_ciudadB }) => {
                    if (!map.has(id_ciudadA)) map.set(id_ciudadA, new Set());
                    if (!map.has(id_ciudadB)) map.set(id_ciudadB, new Set());
                    map.get(id_ciudadA)!.add(id_ciudadB);
                    map.get(id_ciudadB)!.add(id_ciudadA);
                });
                setNeighbors(map);
            })
            .catch(() => toast.error("Error al cargar los tramos"));
    }, [token]);

    return neighbors;
};
