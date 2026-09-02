import { describe, it, expect } from "vitest";
import { renderTotpQr } from "./totpQr";

describe("renderTotpQr", () => {
  it("renders an otpauth:// URI as inline SVG markup", async () => {
    const svg = await renderTotpQr("otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP&issuer=Osefi");

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("never echoes the input string back into the markup", async () => {
    // The whole reason this is safe to inject with dangerouslySetInnerHTML:
    // the otpauth URI becomes QR modules, not literal text in the SVG.
    const otpauth = "otpauth://totp/Osefi:ada?secret=JBSWY3DPEHPK3PXP&issuer=Osefi";
    const svg = await renderTotpQr(otpauth);

    expect(svg).not.toContain(otpauth);
    expect(svg).not.toContain("JBSWY3DPEHPK3PXP");
  });
});
