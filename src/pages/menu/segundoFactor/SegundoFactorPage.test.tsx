import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SegundoFactorPage from "./SegundoFactorPage";

// This page is pure composition — TotpSection.test.tsx and
// RecoveryCodesSection.test.tsx already cover what each section does on its
// own, including the DOM-order test that matters most (remove-before-add
// inside TotpSection). What is left to pin here is that the page assembles
// both and says what the screen is for, so both sections are stubbed rather
// than exercised again.
vi.mock("./TotpSection", () => ({ default: () => <div data-testid="totp-section-stub" /> }));
vi.mock("./RecoveryCodesSection", () => ({ default: () => <div data-testid="recovery-codes-section-stub" /> }));

describe("SegundoFactorPage", () => {
  it("renders both sections, TOTP before recovery codes", () => {
    render(<SegundoFactorPage />);

    const totp = screen.getByTestId("totp-section-stub");
    const codigos = screen.getByTestId("recovery-codes-section-stub");
    expect(totp.compareDocumentPosition(codigos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says in plain words what a second factor is for", () => {
    render(<SegundoFactorPage />);

    expect(screen.getByRole("heading", { name: /segundo factor/i })).toBeInTheDocument();
  });
});
