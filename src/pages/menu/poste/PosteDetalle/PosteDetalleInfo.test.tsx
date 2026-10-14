import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PosteDetalleInfo from "./PosteDetalleInfo";
import type { PosteInterface } from "../../../../interfaces/interfaces";

const TRAMO = {
  id: 14, nombre: "Potosí – Sucre", id_departamento: 3, departamento: { id: 3, name: "Chuquisaca" }, archivado: false,
  ciudades: [
    { id: 11, name: "Potosí", lat: -19.58, lng: -65.75 },
    { id: 12, name: "Sucre", lat: -19.03, lng: -65.26 },
  ],
};

const poste = (tramo: unknown = TRAMO) =>
  ({ id: 2438, name: "P52", id_tramo: tramo ? 14 : null, tramo }) as unknown as PosteInterface;

const pintar = (p: PosteInterface, canVerTramos = true) =>
  render(
    <MemoryRouter>
      <PosteDetalleInfo loading={false} poste={p} metrics={null} canVerTramos={canVerTramos} />
    </MemoryRouter>,
  );

describe("the tramo of a pole, in its sheet", () => {
  it("is a labelled row: the name the server built, its department, and a link to that tramo's own card", () => {
    pintar(poste());

    expect(screen.getByText("Tramo")).toBeInTheDocument();
    expect(screen.getByText("Chuquisaca")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Potosí – Sucre" })).toHaveAttribute("href", "/app/tramos/14");
  });

  it("is text and not a link for a role that may not see tramos", () => {
    pintar(poste(), false);

    expect(screen.getByText("Potosí – Sucre")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("is text for an archived tramo: it has no card to open", () => {
    pintar(poste({ ...TRAMO, archivado: true }));

    expect(screen.getByText("Potosí – Sucre")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("names no department for a tramo that has none", () => {
    pintar(poste({ ...TRAMO, id_departamento: null, departamento: null }));

    expect(screen.getByRole("link", { name: "Potosí – Sucre" })).toBeInTheDocument();
    expect(screen.queryByText("Chuquisaca")).toBeNull();
  });

  it("is left out for a pole that came without one", () => {
    pintar(poste(null));

    expect(screen.queryByText("Tramo")).toBeNull();
  });
});
