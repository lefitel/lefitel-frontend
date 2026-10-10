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
