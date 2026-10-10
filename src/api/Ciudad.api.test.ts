// What an edit sends, which stopped being "whatever the form was holding".
//
// The city list carries figures now — `postes`, `vecinas`, `pendientes` — and
// the form hands `editCiudad` the very row it was opened with. The server writes
// its bitácora entry from the body it receives, so a client that forwards that
// row records every rename as a change to counts nobody touched.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { editCiudad, type CiudadConCifras } from "./Ciudad.api";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("editCiudad", () => {
  it("sends the city's own four columns and none of the list's figures", async () => {
    const put = vi.spyOn(axios, "put").mockResolvedValue({ data: {} });
    const fila: CiudadConCifras = {
      id: 7, name: "Robore", image: "r.jpg", lat: -18.3, lng: -59.7,
      createdAt: new Date(), updatedAt: new Date(),
      postes: 231, vecinas: [3, 9], pendientes: 3, prioritarios: 1, ultimoEvento: "2026-04-20T04:00:00.000Z",
    };

    await editCiudad(fila);

    expect(String(put.mock.calls[0][0])).toMatch(/\/ciudad\/7$/);
    expect(put.mock.calls[0][1]).toEqual({ name: "Robore", image: "r.jpg", lat: -18.3, lng: -59.7 });
  });
});
