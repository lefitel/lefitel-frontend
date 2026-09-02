import QRCode from "qrcode";

/**
 * Render an `otpauth://` URI as an SVG string, ready to drop straight into
 * the DOM.
 *
 * SVG, not a PNG data URL: `qrcode`'s raster renderers go through the
 * `canvas` package, which needs a native binding this repository never
 * installs — the wrong choice would work in the browser and fail the moment
 * a test imports this module under Vitest's Node process. The SVG renderer
 * is pure JavaScript, so it draws the same code path in the browser and
 * under jsdom.
 *
 * Returns markup, not a component, on purpose: the caller decides how to
 * mount it (`dangerouslySetInnerHTML` today), and this function has no
 * opinion on React at all. Safe to inject as-is — the input is always our
 * own `otpauth://` string from `setupTotp`'s response, and `qrcode` never
 * echoes its input back into the markup it produces; whatever text goes in
 * only ever becomes QR modules, never literal SVG.
 */
export function renderTotpQr(otpauth: string): Promise<string> {
  return QRCode.toString(otpauth, { type: "svg", margin: 1, width: 200 });
}
