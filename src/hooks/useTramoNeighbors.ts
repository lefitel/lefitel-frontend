import { useMemo } from "react";
import { TramoPair } from "../api/opciones.api";

/**
 * Which cities a stretch of line can run to, from the pairs poles actually
 * occupy.
 *
 * **This hook used to fetch `GET /api/poste/tramos` itself, and no longer does.**
 * Its three consumers — the three report screens — now each ask
 * `/api/reporte/options` for the city list anyway, and that response already
 * carries the pairs in its `tramos` block. A hook that kept its own request
 * would have made every report screen fire the *same* endpoint twice per mount,
 * running the `GROUP BY` over `postes` on both: strictly worse than the two
 * different requests it replaced. So the pairs are passed in.
 *
 * The Map is symmetric because a stretch is: the server hands back each pair
 * once, normalised to `(menor, mayor)`, and both comboboxes need to look it up
 * from either end.
 *
 * Memoised on the array's identity, which is what keeps it out of the effects
 * that list `neighbors` as a dependency. Callers hold the pairs in state, so the
 * identity only changes when the response does.
 */
export const useTramoNeighbors = (tramos: TramoPair[] | undefined) =>
    useMemo(() => {
        const map = new Map<number, Set<number>>();
        // `?? []` and not a type that pretends it cannot happen. The block is
        // read off an unvalidated `r.data`, so a server answering without it —
        // a partial deployment, a proxy, a future version of the endpoint —
        // hands `undefined` straight to this loop. That throws inside `useMemo`,
        // during render, and this application has no error boundary anywhere:
        // the three report screens would go blank rather than merely lose their
        // stretch dropdowns.
        (tramos ?? []).forEach(({ id_ciudadA, id_ciudadB }) => {
            if (!map.has(id_ciudadA)) map.set(id_ciudadA, new Set());
            if (!map.has(id_ciudadB)) map.set(id_ciudadB, new Set());
            map.get(id_ciudadA)!.add(id_ciudadB);
            map.get(id_ciudadB)!.add(id_ciudadA);
        });
        return map;
    }, [tramos]);
