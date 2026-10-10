// The four things every form gets from its frame, and the reason each is here.
//
// A dialog closes on Escape and on a click outside, which a side panel also did
// — but fourteen forms now share one frame, so whatever it gets wrong it gets
// wrong fourteen times. These are the behaviours a screen relies on without
// writing them.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FormDialog from "./FormDialog";

type Extra = Partial<React.ComponentProps<typeof FormDialog>>;

const pintar = (extra: Extra = {}) => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  render(
    <FormDialog open onClose={onClose} onSubmit={onSubmit} title="Editar material" {...extra}>
      <label htmlFor="n">Nombre</label>
      <input id="n" defaultValue="Hormigón" />
      <label htmlFor="d">Descripción</label>
      <textarea id="d" />
      <input type="checkbox" aria-label="Activo" />
    </FormDialog>,
  );
  return { onClose, onSubmit, user: userEvent.setup() };
};

describe("leaving a form", () => {
  it("closes straight away when nothing was typed", async () => {
    const { onClose, user } = pintar();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before throwing away what was typed, by every way out", async () => {
    const { onClose, user } = pintar({ dirty: true });

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Seguir editando" }));

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Seguir editando" }));

    await user.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Descartar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not close at all while the request is on its way", async () => {
    const { onClose, user } = pintar({ saving: true });
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("saving a form", () => {
  it("names what is missing beside the button, only once somebody has tried", async () => {
    const { onSubmit, user } = pintar({ missing: ["Nombre", "Material"] });
    expect(screen.queryByRole("alert")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByRole("alert").textContent).toBe("Faltan 2 campos: Nombre y Material");
    // The screen's own validation still runs: it is what paints the field errors.
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("says one field in the singular", async () => {
    const { user } = pintar({ missing: ["Material"] });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByRole("alert").textContent).toBe("Falta 1 campo: Material");
  });

  it("saves on Enter from a text field", async () => {
    const { onSubmit, user } = pintar();
    await user.click(screen.getByLabelText("Nombre"));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("does not save on Enter from a textarea or a checkbox, where it means something else", async () => {
    const { onSubmit, user } = pintar();
    await user.click(screen.getByLabelText("Descripción"));
    await user.keyboard("{Enter}");
    screen.getByLabelText("Activo").focus();
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not save twice while the first request is on its way", async () => {
    const { onSubmit, user } = pintar({ saving: true });
    await user.click(screen.getByLabelText("Nombre"));
    await user.keyboard("{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("puts the verb the screen gave it on the button", () => {
    pintar({ submitLabel: "Crear material" });
    expect(screen.getByRole("button", { name: "Crear material" })).toBeTruthy();
  });
});

describe("a form opened read-only", () => {
  it("offers a way out and no way to save", () => {
    pintar({ onSubmit: undefined });
    expect(screen.queryByRole("button", { name: "Guardar cambios" })).toBeNull();
    // Two: the footer's, and the cross in the corner.
    expect(screen.getAllByRole("button", { name: "Cerrar" })).toHaveLength(2);
  });
});

describe("opening a form", () => {
  it("starts the cursor in the first field", () => {
    pintar();
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre"));
  });
});
