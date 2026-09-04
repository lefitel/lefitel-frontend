// Which cities a stretch can run to — the hook the three report screens hang
// off, and which had never been executed by a test.
//
// It is worth stating what breaks when this is wrong, because none of it looks
// like a failure. The two Tramo comboboxes on every report screen filter the
// city list down to `neighbors.get(id)?.size > 0`, so an empty map means both
// dropdowns offer nothing and print "Sin resultados". Recorrido then cannot be
// generated at all — it requires a stretch. And the map comes out empty for two
// different silent reasons: the `tramos` block read under a wrong name, and the
// symmetry dropped, which loses half the pairs while leaving the screen
// looking perfectly healthy.

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import axios from "axios";
import { useTramoNeighbors } from "./useTramoNeighbors";
import { TramoPair } from "../api/opciones.api";

afterEach(() => {
    vi.restoreAllMocks();
});

const PARES: TramoPair[] = [
  { id_ciudadA: 3, id_ciudadB: 7 },
  { id_ciudadA: 3, id_ciudadB: 11 },
];

describe("useTramoNeighbors", () => {
  it("reads a stretch from both ends", () => {
    const { result } = renderHook(() => useTramoNeighbors(PARES));

    // The server sends each pair once, normalised to (smaller, larger). The
    // "Tramo hasta" combobox looks the pair up from the far end, so a map built
    // in one direction only leaves the second dropdown empty for exactly half
    // the network — with the first one working, which is what makes it hard to
    // recognise as a bug.
    // Numeric sort, not the default: `[7, 11].sort()` compares as text and
    // answers `[11, 7]`.
    expect([...(result.current.get(3) ?? [])].sort((a, b) => a - b)).toEqual([7, 11]);
    expect([...(result.current.get(7) ?? [])]).toEqual([3]);
    expect([...(result.current.get(11) ?? [])]).toEqual([3]);
  });

  it("has no neighbours for a city no pole runs to", () => {
    const { result } = renderHook(() => useTramoNeighbors(PARES));

    expect(result.current.get(99)).toBeUndefined();
  });

  it("is empty, not broken, before the pairs arrive", () => {
    // Every screen renders once with `[]` while the request is in flight.
    const { result } = renderHook(() => useTramoNeighbors([]));

    expect(result.current.size).toBe(0);
  });

  it("hands back the same map until the pairs change", () => {
    // Not a micro-optimisation: `neighbors` is a dependency of the effect that
    // clears an impossible stretch selection on all three screens. A fresh Map
    // on every render would re-run that effect on every render.
    const { result, rerender } = renderHook(
      ({ pares }) => useTramoNeighbors(pares),
      { initialProps: { pares: PARES } },
    );
    const primera = result.current;

    rerender({ pares: PARES });
    expect(result.current).toBe(primera);

    rerender({ pares: [{ id_ciudadA: 1, id_ciudadB: 2 }] });
    expect(result.current).not.toBe(primera);
    expect([...(result.current.get(1) ?? [])]).toEqual([2]);
  });

  it("does not fetch anything of its own", () => {
    // It used to call `GET /api/poste/tramos` itself. That route is gone, but
    // what this guards is the shape of the hook, not the route: a version that
    // asked `/api/reporte/opciones` for the pairs would make every report
    // screen request the same endpoint twice per mount — running the `GROUP BY`
    // over the whole pole table both times — which is worse than the two
    // different requests C2 replaced, while looking on screen exactly the same.
    const get = vi.spyOn(axios, "get");

    renderHook(() => useTramoNeighbors(PARES));

    expect(get).not.toHaveBeenCalled();
  });

  it("survives a response that arrived without the block", () => {
    // Not a hypothetical shape: `r.data` is cast, never validated, so a server
    // answering without `tramos` — a partial deployment, a proxy, a later
    // version of the endpoint — hands `undefined` straight in. The throw would
    // happen inside `useMemo`, during render, and this application has no error
    // boundary anywhere: the three report screens would go blank instead of
    // merely losing their stretch dropdowns.
    const { result } = renderHook(() => useTramoNeighbors(undefined));

    expect(result.current.size).toBe(0);
  });
});
