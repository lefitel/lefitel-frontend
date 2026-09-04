// The activity panel on the city, incident and pole sheets, and the sentence it
// used to say when it had not been allowed to ask.
//
// The panel reads `GET /api/bitacora/`, which is gated by `bitacora:ver`. The
// tabs that draw it are gated by `postes`, `eventos` and `ciudades`. Those are
// not the same permission, and the seeded Coordinador and Cliente roles have the
// second set without the first — so for both of them the request is refused on
// every sheet in the system. The refusal was swallowed by an empty `.catch`, the
// component fell through to its empty state, and what they read was "Sin
// actividad registrada en bitácora": a statement about the record, made when
// nothing about the record was known.
//
// This is the same defect the Bitácora screen's author filter had, one component
// over — and unlike that one it is live today rather than reachable through a
// role somebody might create. The three tests below are the three answers the
// panel can now give, and the whole point is that they are three and not one.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BitacoraPanel from "./BitacoraPanel";

const getAllBitacora = vi.fn();
vi.mock("../api/Bitacora.api", () => ({
  getAllBitacora: (...args: unknown[]) => getAllBitacora(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const pintar = () =>
  render(
    <MemoryRouter>
      <BitacoraPanel entity="Poste" entityId={5} />
    </MemoryRouter>,
  );

/** A rejection shaped like axios's, which is what the component reads. */
const rechazo = (status: number) => Promise.reject({ response: { status } });

describe("what the panel says when it has nothing to show", () => {
  it("says the record is empty only when the record is empty", async () => {
    getAllBitacora.mockResolvedValue({ data: [], total: 0 });

    pintar();

    expect(await screen.findByText(/Sin actividad registrada/)).toBeInTheDocument();
  });

  it("says it was refused, instead of saying nothing ever happened", async () => {
    // The live case: a Coordinador opening any pole. Asserted in both
    // directions, because the defect was not the absence of one sentence — it
    // was the presence of the other one.
    getAllBitacora.mockReturnValue(rechazo(403));

    pintar();

    expect(await screen.findByText(/No tiene permiso/)).toBeInTheDocument();
    expect(screen.queryByText(/Sin actividad registrada/)).not.toBeInTheDocument();
  });

  it("distinguishes a failure from a refusal", async () => {
    // A 500 or a dropped connection is not a permission problem, and telling
    // somebody they lack a permission they have is its own kind of wrong.
    getAllBitacora.mockReturnValue(rechazo(500));

    pintar();

    expect(await screen.findByText(/No se pudo cargar/)).toBeInTheDocument();
    expect(screen.queryByText(/No tiene permiso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sin actividad registrada/)).not.toBeInTheDocument();
  });
});
