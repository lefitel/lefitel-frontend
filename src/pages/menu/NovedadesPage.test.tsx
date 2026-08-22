import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RELEASES } from "../../data/changelog";
import NovedadesPage from "./NovedadesPage";

describe("NovedadesPage", () => {
  it("marks the version being run as the current one", () => {
    render(<NovedadesPage />);

    const heading = screen.getByRole("heading", { name: `Versión ${__APP_VERSION__}` });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    expect(within(section!).getByText("Actual")).toBeInTheDocument();
  });

  it("prints every note of every release", () => {
    render(<NovedadesPage />);

    for (const release of RELEASES) {
      expect(screen.getByRole("heading", { name: `Versión ${release.version}` })).toBeInTheDocument();
      for (const change of release.changes) {
        expect(screen.getByText(change.text)).toBeInTheDocument();
      }
    }
  });

  it("dates each release as a local day, not the UTC one before it", () => {
    render(<NovedadesPage />);

    for (const release of RELEASES) {
      const stamp = document.querySelector(`time[datetime="${release.date}"]`);
      expect(stamp).not.toBeNull();
      // "2026-08-22" must read as the 22nd, whatever the machine's timezone.
      expect(stamp!.textContent).toContain(String(Number(release.date.slice(8, 10))));
    }
  });
});
