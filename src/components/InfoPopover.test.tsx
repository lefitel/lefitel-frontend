// The ⓘ buttons of the home screen were tooltips, which open on hover and
// focus only: on a touch screen the explanation could not be opened. These
// pin the behaviour that replaced them — it opens on a click, and only on one.

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import InfoPopover from "./InfoPopover";

const pintar = () =>
  render(
    <div>
      <InfoPopover label="Información sobre algo">Esto explica algo.</InfoPopover>
      <p>Fuera</p>
    </div>,
  );

describe("InfoPopover", () => {
  it("is closed by default and names its button", () => {
    pintar();

    expect(screen.getByRole("button", { name: "Información sobre algo" })).toBeTruthy();
    expect(screen.queryByText("Esto explica algo.")).toBeNull();
  });

  it("opens on a click", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(screen.getByRole("button", { name: "Información sobre algo" }));

    expect(screen.getByText("Esto explica algo.")).toBeTruthy();
  });

  it("closes on a second click", async () => {
    const user = userEvent.setup();
    pintar();
    const boton = screen.getByRole("button", { name: "Información sobre algo" });

    await user.click(boton);
    await user.click(boton);

    expect(screen.queryByText("Esto explica algo.")).toBeNull();
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(screen.getByRole("button", { name: "Información sobre algo" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByText("Esto explica algo.")).toBeNull();
  });

  it("closes on a click outside it", async () => {
    const user = userEvent.setup();
    pintar();

    await user.click(screen.getByRole("button", { name: "Información sobre algo" }));
    await user.click(screen.getByText("Fuera"));

    expect(screen.queryByText("Esto explica algo.")).toBeNull();
  });

  it("does not open on hover", async () => {
    const user = userEvent.setup();
    pintar();

    await user.hover(screen.getByRole("button", { name: "Información sobre algo" }));

    expect(screen.queryByText("Esto explica algo.")).toBeNull();
  });
});
