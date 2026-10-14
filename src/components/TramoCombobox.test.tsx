// The tramo picker every form and report filter shares.
//
// What it must not do is the point: it does not compose a name (it shows the
// one the server sent), does not reorder (the server sorts, and the browser's
// order would not match the pages'), and offers "Crear tramo nuevo" only when
// the caller says the role may create.

import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TramoCombobox from "./TramoCombobox";
import type { Tramo } from "../interfaces/interfaces";

const ciudad = (id: number) => ({ id, name: `C${id}`, lat: null, lng: null });
const tramo = (id: number, nombre: string, dep: string | null, archivado = false): Tramo => ({
  id,
  nombre,
  ciudades: [ciudad(id * 10), ciudad(id * 10 + 1)],
  id_departamento: dep ? id : null,
  departamento: dep ? { id, name: dep } : null,
  archivado,
});

// Not alphabetical, on purpose.
const TRAMOS = [
  tramo(3, "Sucre – Tarabuco", "Chuquisaca"),
  tramo(1, "Oruro – Potosí", null),
  tramo(2, "Camargo – Sucre", "Chuquisaca"),
];

const abrir = async (props: Partial<React.ComponentProps<typeof TramoCombobox>> = {}) => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<TramoCombobox tramos={TRAMOS} value={null} onChange={onChange} {...props} />);
  await user.click(screen.getByRole("button", { name: "Tramo" }));
  await screen.findByPlaceholderText("Buscar tramo...");
  return { user, onChange };
};

describe("the options", () => {
  it("show the name and, to its right, the department or 'Sin departamento'", async () => {
    await abrir();

    const sucre = screen.getByRole("button", { name: /Sucre – Tarabuco/ });
    expect(within(sucre).getByText("Chuquisaca")).toBeInTheDocument();
    expect(within(sucre).getByText("Chuquisaca")).toHaveClass("text-muted-foreground");
    expect(within(screen.getByRole("button", { name: /Oruro – Potosí/ })).getByText("Sin departamento")).toBeInTheDocument();
  });

  it("keep the order they arrived in", async () => {
    await abrir();

    const nombres = screen.getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => /–/.test(t));
    expect(nombres).toEqual(["Sucre – TarabucoChuquisaca", "Oruro – PotosíSin departamento", "Camargo – SucreChuquisaca"]);
  });

  it("are found by the tramo's name and by its department", async () => {
    const { user } = await abrir();
    const buscador = screen.getByPlaceholderText("Buscar tramo...");

    await user.type(buscador, "oruro");
    expect(screen.queryByRole("button", { name: /Camargo/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Oruro – Potosí/ })).toBeInTheDocument();

    await user.clear(buscador);
    await user.type(buscador, "chuqui");
    expect(screen.queryByRole("button", { name: /Oruro/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /Chuquisaca/ })).toHaveLength(2);
  });

  it("report the id of the one chosen", async () => {
    const { user, onChange } = await abrir();

    await user.click(screen.getByRole("button", { name: /Camargo – Sucre/ }));

    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("'Todos los tramos'", () => {
  it("is not offered unless asked for", async () => {
    await abrir();
    expect(screen.queryByRole("button", { name: /Todos los tramos/ })).toBeNull();
  });

  it("is the first entry when asked for, and chooses null", async () => {
    const { user, onChange } = await abrir({ permitirTodos: true });

    const entradas = screen.getAllByRole("button").map((b) => b.textContent ?? "");
    const primera = entradas.findIndex((t) => /Todos los tramos/.test(t));
    expect(primera).toBeGreaterThan(-1);
    expect(entradas.findIndex((t) => /Sucre – Tarabuco/.test(t))).toBeGreaterThan(primera);

    await user.click(screen.getByRole("button", { name: /Todos los tramos/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("is what the trigger says when nothing is chosen", () => {
    render(<TramoCombobox tramos={TRAMOS} value={null} onChange={vi.fn()} permitirTodos />);
    expect(screen.getByRole("button", { name: "Tramo" })).toHaveTextContent("Todos los tramos");
  });
});

describe("'Crear tramo nuevo'", () => {
  it("does not exist without onCrear", async () => {
    await abrir();
    expect(screen.queryByRole("button", { name: "Crear tramo nuevo" })).toBeNull();
  });

  it("is the last entry with onCrear, and calls it without changing the value", async () => {
    const onCrear = vi.fn();
    const { user, onChange } = await abrir({ onCrear });

    await user.click(screen.getByRole("button", { name: "Crear tramo nuevo" }));

    expect(onCrear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("the current value", () => {
  it("shows the chosen tramo's name and department on the trigger", () => {
    render(<TramoCombobox tramos={TRAMOS} value={2} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tramo" })).toHaveTextContent("Camargo – SucreChuquisaca");
  });

  it("is the placeholder when there is none", () => {
    render(<TramoCombobox tramos={TRAMOS} value={null} onChange={vi.fn()} placeholder="Elige un tramo" />);
    expect(screen.getByRole("button", { name: "Tramo" })).toHaveTextContent("Elige un tramo");
  });

  it("can be an archived tramo that is not in the list, shown with 'archivado'", () => {
    const viejo = tramo(9, "Viejo – Antiguo", "Oruro", true);
    render(<TramoCombobox tramos={TRAMOS} actual={viejo} value={9} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tramo" })).toHaveTextContent("Viejo – Antiguoarchivado");
  });

  it("does not offer that archived tramo again once another one is chosen", async () => {
    const viejo = tramo(9, "Viejo – Antiguo", "Oruro", true);
    const user = userEvent.setup();
    render(<TramoCombobox tramos={TRAMOS} actual={viejo} value={2} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Tramo" }));
    await screen.findByPlaceholderText("Buscar tramo...");

    expect(screen.queryByRole("button", { name: /Viejo – Antiguo/ })).toBeNull();
  });
});

describe("a tramo that arrives without a department object", () => {
  it("does not take the picker down", () => {
    const roto = { ...TRAMOS[0], departamento: undefined } as unknown as Tramo;
    expect(() => render(<TramoCombobox tramos={[roto]} value={3} onChange={vi.fn()} />)).not.toThrow();
  });
});
