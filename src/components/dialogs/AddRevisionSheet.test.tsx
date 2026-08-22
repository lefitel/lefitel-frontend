// What the dialog does when the server says no.
//
// It used to say "Revisión agregada" either way. `createRevision` catches its
// own rejection and returns a status number, so the `try/catch` here could
// never fire, and the return value was discarded — which meant a 403, a 500 and
// a dead network all produced a success toast, closed the sheet, and threw away
// what the technician had typed. The work was gone with nothing on screen to
// suggest it.
//
// `ResolverEventoSheet` next door has always checked the number. These tests
// hold this dialog to the same bargain.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SesionContext, type contextProps } from "../../context/SesionContext";
import type { SesionInterface } from "../../interfaces/interfaces";
import AddRevisionSheet from "./AddRevisionSheet";

const createRevision = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("../../api/Revision.api", () => ({ createRevision }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

const sesion = { usuario: { id: 7 }, token: "t" } as unknown as SesionInterface;

function renderSheet() {
  const onSuccess = vi.fn();
  const setOpen = vi.fn();
  render(
    <SesionContext.Provider value={{ sesion } as unknown as contextProps}>
      <AddRevisionSheet eventoId={42} open onSuccess={onSuccess} setOpen={setOpen} />
    </SesionContext.Provider>,
  );
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
    createRevision.mockResolvedValue(200);
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Revisión agregada"));
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(setOpen).toHaveBeenCalledWith(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not claim success when the account may not do it", async () => {
    createRevision.mockResolvedValue(403);
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
    createRevision.mockResolvedValue(403);
    renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0][0])).toMatch(/permiso/i);
  });

  it("does not claim success when the server fails", async () => {
    createRevision.mockResolvedValue(500);
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(setOpen).not.toHaveBeenCalledWith(false);
  });

  it("does not claim success when the request never arrives", async () => {
    // What `.catch(() => 0)` in the api layer reports: no response at all.
    createRevision.mockResolvedValue(0);
    const { onSuccess, setOpen } = renderSheet();

    await fillAndSave();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
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
