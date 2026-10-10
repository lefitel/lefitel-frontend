// The closed incidents of a pole could be counted from its sheet and not read:
// the card called "Historial" listed the open ones only.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PosteDetalleEventosResueltos from "./PosteDetalleEventosResueltos";
import type { EventoInterface } from "../../../../interfaces/interfaces";

const evento = (over: Record<string, unknown>) => over as unknown as EventoInterface;

const EVENTOS = [
  evento({ id: 1, description: "Herraje suelto", state: true, date: "2026-07-01", solucions: [{ date: "2026-07-04" }] }),
  evento({ id: 2, description: "Cable caído", state: false, date: "2026-09-01" }),
  evento({ id: 3, description: "Vegetación", state: true, date: "2026-09-01", solucions: [{ date: "2026-09-02" }] }),
];

describe("the resolved incidents of a pole", () => {
  it("lists the closed ones only, the latest closed first, and opens the one pressed", async () => {
    const user = userEvent.setup();
    const onVerDetalle = vi.fn();
    render(<PosteDetalleEventosResueltos loading={false} eventos={EVENTOS} onVerDetalle={onVerDetalle} />);

    const filas = screen.getAllByRole("button");
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining("Vegetación"),
      expect.stringContaining("Herraje suelto"),
    ]);
    expect(screen.queryByText("Cable caído")).toBeNull();
    expect(filas[1].textContent).toContain("en 3 días");

    await user.click(filas[0]);
    expect(onVerDetalle).toHaveBeenCalledWith(3);
  });

  it("says so when there are none", () => {
    render(<PosteDetalleEventosResueltos loading={false} eventos={[EVENTOS[1]]} onVerDetalle={vi.fn()} />);

    expect(screen.getByText("Este poste no tiene eventos resueltos.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
