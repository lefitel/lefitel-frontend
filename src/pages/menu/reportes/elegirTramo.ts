// Shared by the report screens' tests: picks an entry of the tramo selector.

import { expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

/** Opens the tramo selector, picks the entry whose name matches, and leaves the list closed. */
export const elegirTramo = async (
  user: ReturnType<typeof userEvent.setup>,
  nombre: string | RegExp,
) => {
  await user.click(screen.getByRole("button", { name: "Tramo" }));
  await user.click(await screen.findByRole("button", { name: nombre }));
  // The list stays open after a choice (the shared Combobox only closes on an
  // outside press or Escape), and a second press on the trigger would shut it.
  await user.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByPlaceholderText("Buscar tramo...")).toBeNull());
};
