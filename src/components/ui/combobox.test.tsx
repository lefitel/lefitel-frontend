// The picker lists rows the server sends, and a row can arrive with no name.
//
// One did: a role saved without one. The search lower-cases every label on every
// render, so that single option threw before anything was drawn — and with no
// error boundary above it, the screen that held the picker went blank.

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Combobox } from "./combobox";

const options = [
  { value: "1", label: "Administrador" },
  // What the wire carries, whatever the type says.
  { value: "7", label: null as unknown as string },
];

describe("an option that arrives without a label", () => {
  it("does not take the picker down", () => {
    expect(() =>
      render(<Combobox options={options} value="" onValueChange={vi.fn()} ariaLabel="Rol" />),
    ).not.toThrow();

    expect(screen.getByRole("button", { name: "Rol" })).toBeInTheDocument();
  });

  it("still finds the ones that have one", async () => {
    const user = userEvent.setup();
    render(<Combobox options={options} value="" onValueChange={vi.fn()} ariaLabel="Rol" />);

    await user.click(screen.getByRole("button", { name: "Rol" }));
    await user.type(await screen.findByPlaceholderText("Buscar..."), "admin");

    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });
});

describe("a picker that cannot be changed", () => {
  it("shows the chosen value and does not open", async () => {
    const user = userEvent.setup();
    render(<Combobox options={options} value="1" onValueChange={vi.fn()} ariaLabel="Rol" disabled />);

    const disparador = screen.getByRole("button", { name: "Rol" });
    expect(disparador).toBeDisabled();
    expect(disparador).toHaveTextContent("Administrador");

    await user.click(disparador);
    expect(screen.queryByPlaceholderText("Buscar...")).toBeNull();
  });
});

describe("an option with a secondary text", () => {
  const conHint = [
    { value: "1", label: "Potosí – Sucre", hint: "Chuquisaca" },
    { value: "2", label: "Oruro – Potosí" },
  ];

  it("shows it beside the label in the list and beside the chosen value, and finds the option by it", async () => {
    const user = userEvent.setup();
    render(<Combobox options={conHint} value="1" onValueChange={vi.fn()} ariaLabel="Tramo" />);

    // On the trigger: the label and the hint, two separate pieces of text.
    const disparador = screen.getByRole("button", { name: "Tramo" });
    expect(disparador).toHaveTextContent("Potosí – SucreChuquisaca");

    await user.click(disparador);
    const lista = await screen.findByPlaceholderText("Buscar...");
    expect(screen.getAllByText("Chuquisaca")).toHaveLength(2);

    await user.type(lista, "chuqui");
    expect(screen.queryByText("Oruro – Potosí")).toBeNull();
    expect(screen.getAllByText("Potosí – Sucre").length).toBeGreaterThan(0);
  });

  it("matches the label and the hint separately: a query does not span the boundary between them", async () => {
    const user = userEvent.setup();
    render(<Combobox options={conHint} value="" onValueChange={vi.fn()} ariaLabel="Tramo" />);

    await user.click(screen.getByRole("button", { name: "Tramo" }));
    const lista = await screen.findByPlaceholderText("Buscar...");
    // "Sucre" ends the label and "Chuquisaca" starts the hint: only the joined text held this.
    await user.type(lista, "sucre chuqui");
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });

  it("does not match a trailing space against an option that has no hint", async () => {
    const user = userEvent.setup();
    render(<Combobox options={conHint} value="" onValueChange={vi.fn()} ariaLabel="Tramo" />);

    await user.click(screen.getByRole("button", { name: "Tramo" }));
    const lista = await screen.findByPlaceholderText("Buscar...");
    // "Oruro – Potosí" has no hint: it used to be found as "Oruro – Potosí " (label + a space).
    await user.type(lista, "potosí ");
    expect(screen.queryByText("Oruro – Potosí")).toBeNull();
  });

  it("renders an option without one exactly as before", async () => {
    const user = userEvent.setup();
    render(<Combobox options={[{ value: "2", label: "Oruro – Potosí" }]} value="2" onValueChange={vi.fn()} ariaLabel="Tramo" />);

    expect(screen.getByRole("button", { name: "Tramo" }).textContent).toBe("Oruro – Potosí");
    await user.click(screen.getByRole("button", { name: "Tramo" }));
    expect(document.querySelectorAll("[data-combobox-hint]")).toHaveLength(0);
  });
});

describe("a footer action", () => {
  it("is the last entry, runs without choosing anything, and closes the list", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onSelect = vi.fn();
    render(
      <Combobox
        options={options}
        value=""
        onValueChange={onValueChange}
        ariaLabel="Rol"
        footer={{ label: "Crear rol nuevo", onSelect }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Rol" }));
    await user.click(await screen.findByRole("button", { name: "Crear rol nuevo" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onValueChange).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByPlaceholderText("Buscar...")).toBeNull());
  });

  it("stays when the search finds nothing, so a missing item can be created from the list that lacks it", async () => {
    const user = userEvent.setup();
    render(
      <Combobox options={options} value="" onValueChange={vi.fn()} ariaLabel="Rol"
        footer={{ label: "Crear rol nuevo", onSelect: vi.fn() }} />,
    );

    await user.click(screen.getByRole("button", { name: "Rol" }));
    await user.type(await screen.findByPlaceholderText("Buscar..."), "zzz");

    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear rol nuevo" })).toBeInTheDocument();
  });

  it("is absent by default", async () => {
    const user = userEvent.setup();
    render(<Combobox options={options} value="" onValueChange={vi.fn()} ariaLabel="Rol" />);
    await user.click(screen.getByRole("button", { name: "Rol" }));
    await screen.findByPlaceholderText("Buscar...");
    expect(screen.queryByRole("button", { name: /nuevo/i })).toBeNull();
  });
});
