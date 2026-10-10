// A view of the pole's panel is only offered to a role that may read it.
//
// The log's endpoint asks for `bitacora.ver`, which the seeded Coordinador and
// Cliente roles do not hold. A Bitácora tab was drawn for them anyway, and all
// it ever held was "No tiene permiso para ver la bitácora" — on every pole,
// incident and city sheet. The same rule is written inline in
// `EventoDetallePage` and `CiudadDetallePage`; on the pole it lives on the rail,
// which is the only way into a view.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PosteDetalleRail from "./PosteDetalleRail";

const pintar = (over: Partial<React.ComponentProps<typeof PosteDetalleRail>> = {}) => {
  const props = {
    vista: "resumen" as const, onVista: vi.fn(),
    canVerEventos: true, canVerBitacora: true, resueltos: 9, vecinos: 41, ...over,
  };
  render(<PosteDetalleRail {...props} />);
  return props;
};

describe("the views of a pole's panel", () => {
  it("does not offer the log to a role that cannot read it", () => {
    pintar({ canVerBitacora: false });

    expect(screen.queryByRole("tab", { name: /Bitácora/ })).toBeNull();
    // The other views are untouched: this hides one of them, not the rail.
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("offers it to a role that can", () => {
    pintar();

    expect(screen.getByRole("tab", { name: /Bitácora/ })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(4);
  });

  it("does not offer the resolved incidents to a role without incidents", () => {
    pintar({ canVerEventos: false });

    expect(screen.queryByRole("tab", { name: /Resueltos/ })).toBeNull();
    expect(screen.getByRole("tab", { name: /Vecinos/ })).toBeInTheDocument();
  });

  it("marks the view in use, and asks for the one pressed", async () => {
    const user = userEvent.setup();
    const props = pintar({ vista: "vecinos" });

    expect(screen.getByRole("tab", { name: /Vecinos/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Resumen/ })).toHaveAttribute("aria-selected", "false");

    await user.click(screen.getByRole("tab", { name: /Bitácora/ }));
    expect(props.onVista).toHaveBeenCalledWith("bitacora");
  });

  it("moves along the rail with the arrows, round the end", async () => {
    const user = userEvent.setup();
    const props = pintar({ vista: "bitacora" });

    screen.getByRole("tab", { name: /Bitácora/ }).focus();
    await user.keyboard("{ArrowDown}");

    expect(props.onVista).toHaveBeenCalledWith("resumen");
  });
});
