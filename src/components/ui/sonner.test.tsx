import { act, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeProvider } from "@/components/theme-provider";
import { mockSystemTheme } from "@/test/system-theme";
import { Toaster } from "./sonner";

const STORAGE_KEY = "test-theme";

function renderToaster(
  appTheme: "light" | "dark" | "system",
  props: Record<string, unknown> = {},
) {
  return render(
    <ThemeProvider defaultTheme={appTheme} storageKey={STORAGE_KEY}>
      <Toaster richColors {...props} />
    </ThemeProvider>,
  );
}

/** The toaster element only exists while a toast is on screen. */
async function showWelcomeToast() {
  act(() => {
    toast.success("Bienvenido");
  });
  await screen.findByText("Bienvenido");
  return document.querySelector("[data-sonner-toaster]");
}

describe("Toaster", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
  });

  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
  });

  it("matches the app theme even when the OS prefers the opposite", async () => {
    mockSystemTheme(true);
    renderToaster("light");

    expect(await showWelcomeToast()).toHaveAttribute(
      "data-sonner-theme",
      "light",
    );
  });

  it("ignores a theme passed from the outside so it cannot drift from the app", async () => {
    mockSystemTheme(true);
    renderToaster("light", { theme: "system" });

    expect(await showWelcomeToast()).toHaveAttribute(
      "data-sonner-theme",
      "light",
    );
  });

  it("follows the OS preference when the app is set to system", async () => {
    mockSystemTheme(true);
    renderToaster("system");

    expect(await showWelcomeToast()).toHaveAttribute(
      "data-sonner-theme",
      "dark",
    );
  });
});
