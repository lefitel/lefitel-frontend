import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { mockSystemTheme } from "@/test/system-theme";
import { ThemeProvider, useTheme } from "./theme-provider";

const STORAGE_KEY = "test-theme";

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        toggle
      </button>
    </>
  );
}

function renderProbe(defaultTheme?: "light" | "dark" | "system") {
  return render(
    <ThemeProvider defaultTheme={defaultTheme} storageKey={STORAGE_KEY}>
      <Probe />
    </ThemeProvider>,
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("light", "dark");
  });

  it("resolves an explicit theme regardless of the OS preference", () => {
    mockSystemTheme(true);
    renderProbe("light");

    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement).toHaveClass("light");
  });

  it("follows the OS preference while set to system", () => {
    mockSystemTheme(true);
    renderProbe("system");

    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
  });

  it("reacts when the OS preference changes while set to system", () => {
    const system = mockSystemTheme(true);
    renderProbe("system");

    system.set(false);

    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
    expect(document.documentElement).toHaveClass("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("stops following the OS once an explicit theme is chosen", async () => {
    const system = mockSystemTheme(true);
    renderProbe("system");

    await userEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");

    system.set(false);
    expect(screen.getByTestId("resolved")).toHaveTextContent("light");
  });

  it("restores the stored theme on mount", () => {
    localStorage.setItem(STORAGE_KEY, "dark");
    mockSystemTheme(false);
    renderProbe("light");

    expect(screen.getByTestId("resolved")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveClass("dark");
  });
});
