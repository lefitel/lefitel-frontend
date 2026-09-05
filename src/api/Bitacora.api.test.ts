// The two reads the Bitácora screen makes, and the address each of them uses.
//
// `getAutoresBitacora` exists because the screen used to fill its author filter
// from `getUsuario()` — the staff directory, which asks for `seguridad:ver`. A
// role holding `bitacora:ver` and not that one was refused, the page swallowed
// the 403, and the filter showed "Todos" and nothing else. So the address is not
// a detail here: it is the whole fix. A call that goes back to `/usuario/`
// reproduces the defect exactly, with the screen looking fine and the suite
// green, which is why the assertion below is anchored rather than a substring
// match — `/api/usuario/` and `/api/bitacora/` both contain most of what a loose
// pattern would look for.
//
// The rejection test is the other half of it. The page shows a message when this
// fails, and a client that caught its own error and answered an empty list would
// leave the same empty dropdown with no message at all: the original defect,
// rebuilt one layer down.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";
import { getAutoresBitacora, getAllBitacora } from "./Bitacora.api";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Two live authors and one archived, as the endpoint serves them. */
const AUTORES = [
  { id: 4, name: "Ana", lastname: "Quispe", deletedAt: null },
  { id: 9, name: "Bruno", lastname: "Mamani", deletedAt: "2026-05-02T00:00:00.000Z" },
];

describe("getAutoresBitacora", () => {
  it("asks the audit log for its own authors, not the staff directory", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: AUTORES });

    await getAutoresBitacora();

    expect(get).toHaveBeenCalledTimes(1);
    // Anchored at the end: `/api/usuario/` is the address this replaced and the
    // one a tidy-up would drift back to, and it needs a different permission.
    expect(String(get.mock.calls[0][0])).toMatch(/\/bitacora\/authors$/);
  });

  it("sends no filters, because the list is not a page of anything", async () => {
    // `getAllBitacora` below takes `page` and `limit`; this endpoint answers one
    // block, and a `limit` sent here would be read by nothing and quietly imply
    // it was.
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: AUTORES });

    await getAutoresBitacora();

    expect(get.mock.calls[0][1]).toBeUndefined();
  });

  it("hands back the list the server sent, archived flag included", async () => {
    // The flag is what lets the screen mark a former employee instead of showing
    // them as current staff. Read off the resolved value rather than trusted:
    // a client that mapped the rows through a narrower shape would drop it here.
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: AUTORES });

    const autores = await getAutoresBitacora();

    expect(get).toHaveBeenCalled();
    expect(autores).toEqual(AUTORES);
    expect(autores[1].deletedAt).toBeTruthy();
  });

  it("lets a refusal reach the caller", async () => {
    // The screen catches this and says so. Swallowed here — answering `[]`, or
    // `undefined` — the dropdown would be empty with nothing to explain it,
    // which is the exact defect this endpoint was added to end.
    vi.spyOn(axios, "get").mockRejectedValue({ response: { status: 403 } });

    await expect(getAutoresBitacora()).rejects.toBeTruthy();
  });
});

describe("getAllBitacora", () => {
  it("passes its filters through as query parameters", async () => {
    // Not new, and asserted because the file exists now: this is the read the
    // table itself makes, and it is the one call on this screen that carries
    // user input to the server.
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { data: [], total: 0 } });

    await getAllBitacora({ id_usuario: 9, page: 2, limit: 50 });

    expect(String(get.mock.calls[0][0])).toMatch(/\/bitacora\/$/);
    expect((get.mock.calls[0][1] as { params: unknown }).params)
      .toEqual({ id_usuario: 9, page: 2, limit: 50 });
  });
});
