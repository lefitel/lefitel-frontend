import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PosteDetalleHeader from "./PosteDetalleHeader";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const POSTE = { id: 2438, name: "P52" } as unknown as PosteInterface;

const pintar = (over: Partial<React.ComponentProps<typeof PosteDetalleHeader>> = {}) => {
  const props = {
    loading: false, poste: POSTE, canCreateEvento: true, canEditPoste: true,
    onNuevoEvento: vi.fn(), onEditarPoste: vi.fn(), onRefrescar: vi.fn(), ...over,
  };
  render(<PosteDetalleHeader {...props} />);
  return props;
};

describe("the actions of a pole's header", () => {
  it("are on the header, one press each", async () => {
    // They sat behind a «⋯» that held these two and nothing else: a click to
    // find them and a click to use them.
    const user = userEvent.setup();
    const props = pintar();

    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Refrescar" }));

    expect(props.onEditarPoste).toHaveBeenCalledTimes(1);
    expect(props.onRefrescar).toHaveBeenCalledTimes(1);
    // And nothing is left that opens a menu.
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("does not offer editing to a role that may not edit poles", () => {
    pintar({ canEditPoste: false });

    expect(screen.queryByRole("button", { name: "Editar" })).toBeNull();
    // Refreshing is not a permission.
    expect(screen.getByRole("button", { name: "Refrescar" })).toBeInTheDocument();
  });

  it("walks to the pole either side along the stretch", async () => {
    const user = userEvent.setup();
    const onVerPoste = vi.fn();
    pintar({
      posicionEnTramo: { index: 2, total: 3 },
      anterior: { id: 2437, name: "P51" } as unknown as PosteInterface,
      siguiente: { id: 2439, name: "P53" } as unknown as PosteInterface,
      onVerPoste,
    });

    await user.click(screen.getByRole("button", { name: "Poste anterior, P51" }));
    await user.click(screen.getByRole("button", { name: "Poste siguiente, P53" }));

    expect(onVerPoste.mock.calls).toEqual([[2437], [2439]]);
    expect(screen.getByText("Posición 2 de 3")).toBeInTheDocument();
  });

  it("offers no step past the end of the stretch", () => {
    pintar({
      posicionEnTramo: { index: 1, total: 2 },
      anterior: null,
      siguiente: { id: 2439, name: "P53" } as unknown as PosteInterface,
    });

    expect(screen.queryByRole("button", { name: /Poste anterior/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Poste siguiente, P53" })).toBeInTheDocument();
  });

  it("says the pole's state beside its name, and nothing for a role without incidents", () => {
    const { unmount } = render(
      <PosteDetalleHeader
        loading={false} poste={POSTE} status="critico" canCreateEvento canEditPoste
        onNuevoEvento={vi.fn()} onEditarPoste={vi.fn()} onRefrescar={vi.fn()}
      />,
    );
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    unmount();

    pintar({ status: null });
    expect(screen.queryByText(/Crítico|Atención|Operativo/)).toBeNull();
  });

  it("holds both back while the pole is still loading", () => {
    pintar({ loading: true, poste: null });

    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Refrescar" })).toBeDisabled();
  });
});
