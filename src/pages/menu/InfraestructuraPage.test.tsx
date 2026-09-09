import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import InfraestructuraPage from "./InfraestructuraPage";

describe("InfraestructuraPage", () => {
  /**
   * The one failure this screen can have that nothing else would report.
   *
   * The address is a string in a component and the diagram is a file on disk;
   * nothing but this test makes the two agree. Move, rename or forget to commit
   * `dev/arquitectura-osefi.html` and the screen still mounts, still draws its
   * heading, and shows an empty frame — a blank rectangle reads as "the diagram
   * has no content", not as "the file is gone", so the wrong thing gets
   * investigated.
   *
   * Asserted from the rendered `src` rather than from a constant, because a
   * constant that agrees with itself proves nothing.
   */
  it("points at a diagram that is actually there", () => {
    render(<InfraestructuraPage />);

    const frame = screen.getByTitle("Diagrama de la infraestructura de Osefi");
    const src = frame.getAttribute("src");
    expect(src).toBeTruthy();

    // `/dev/...` is served from the project root by the dev server, so the URL
    // path and the repository path are the same thing minus the leading slash.
    const onDisk = path.resolve(import.meta.dirname, "../../..", src!.replace(/^\//, ""));
    expect(existsSync(onDisk), `no existe el fichero que enmarca la pantalla: ${onDisk}`).toBe(true);
  });
});
