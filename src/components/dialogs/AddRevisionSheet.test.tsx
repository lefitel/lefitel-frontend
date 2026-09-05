// What the dialog does when the server says no.
//
// It used to say "Revisión agregada" either way: `createRevision` caught its
// own rejection and returned a status number, so the `try/catch` in the sheet
// could never fire and the return value was discarded — a 403, a 500 and a dead
// network all produced a success toast, closed the sheet, and threw away what
// the technician had typed. The work was gone with nothing on screen to suggest
// it.
//
// Since C4 the failure travels as a rejection and the number is gone from both
// sides. That closes a second hole this file used to have and could not see:
// every one of these mocks resolved a **literal status**, so the sheet's
// `status !== 200` was being fed 200 by the test rather than by the server.
// `POST /api/revision` answers `201` now. Had the mocks stayed, this file would
// have gone on passing while every saved inspection reported a failure and got
// typed in a second time — the same incident as the first one, in the other
// direction, and this time producing duplicate rows.
//
// So the fakes here are built by `src/test/fallos.ts`, which shapes them the
// way `http.ts`'s normalizer really shapes them.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AddRevisionSheet from "./AddRevisionSheet";
import { rechazoDelServidor, sinConexion } from "../../test/fallos";

/**
 * The sentence `requirePermission` really answers, copied from the API.
 *
 * It matters that this is the server's words and not a plausible-looking
 * invention: the first version of these tests mocked "No tienes permiso para
 * registrar revisiones", which reads well and does not exist anywhere in
 * `api/src`. A test that asserts a sentence the product cannot produce proves
 * the reader works and says nothing about what the person will read.
 *
 * Worth naming the trade this made, too. The screen used to write that specific
 * sentence itself, off `status === 403`. What it shows now is the server's
 * generic one — less specific, and the price of having one place decide what a
 * refusal says. Making it specific again is the API's job, not this dialog's.
 */
const PERMISO_DENEGADO = "No tiene permiso para realizar esta acción.";

const createRevision = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("../../api/Revision.api", () => ({ createRevision }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

// No `SesionContext.Provider` here: `AddRevisionSheet.tsx` never imports
// `SesionContext` or reads `sesion` anywhere in its 110 lines, so wrapping it
// in one — and fixing up the fixture's `autenticado` field, as task 5 did —
// was dead scaffolding protecting nothing. Confirmed by removing it and
// re-running this file: same five tests, same result.
function renderSheet() {
  const onSuccess = vi.fn();
  const setOpen = vi.fn();
  render(<AddRevisionSheet eventoId={42} open onSuccess={onSuccess} setOpen={setOpen} />);
  return { onSuccess, setOpen };
}

async function fillAndSave() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText(/describe la inspección/i), "Poste revisado, sigue inclinado");
  await user.click(screen.getByRole("button", { name: /guardar revisión/i }));
}

beforeEach(() => {
  createRevision.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

describe("AddRevisionSheet", () => {
  it("saves and reports success when the server accepts it", async () => {
    // The row the server sends back, which is what a 201 carries. Nothing here
    // reads it — and that is the point: the sheet no longer looks at the answer
    // at all, only at whether there was one.
    createRevision.mockResolvedValue({ id: 7, description: "Poste revisado, sigue inclinado" });
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Revisión agregada"));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not claim success when the account may not do it", async () => {
    createRevision.mockRejectedValue(rechazoDelServidor(403, PERMISO_DENEGADO));
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    // The sheet stays open and the parent is not told to reload, so the text the
    // technician wrote is still on screen to retry or copy elsewhere.
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalledWith(false);
  });

  it("says it is a permission problem when that is what it is", async () => {
    // And says it in the server's words. The sheet used to write this sentence
    // itself, from `status === 403`; now the side that made the decision is the
    // side that phrases it, so a refusal for some other reason stops being
    // reported as a missing permission.
    createRevision.mockRejectedValue(rechazoDelServidor(403, PERMISO_DENEGADO));
    renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/permiso/i);
  });

  it("does not claim success when the server fails", async () => {
    // A 500 answers the neutral sentence, so the screen's own words are what
    // should show. This is the direction that proves the reader is not simply
    // printing whatever it is handed.
    createRevision.mockRejectedValue(rechazoDelServidor(500));
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/no se pudo agregar la revisión/i);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalledWith(false);
  });

  it("does not claim success when the request never arrives", async () => {
    createRevision.mockRejectedValue(sinConexion());
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/sin conexión/i);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalledWith(false);
  });

  it("still refuses to send an empty description", async () => {
    renderSheet();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /guardar revisión/i }));

    expect(createRevision).not.toHaveBeenCalled();
    expect(screen.getByText(/la descripción es requerida/i)).toBeInTheDocument();
  });
});
