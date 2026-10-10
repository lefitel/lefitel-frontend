// The picker lists rows the server sends, and a row can arrive with no name.
//
// One did: a role saved without one. The search lower-cases every label on every
// render, so that single option threw before anything was drawn — and with no
// error boundary above it, the screen that held the picker went blank.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
