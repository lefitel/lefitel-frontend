// The upload client: what it does to a photograph before it leaves the phone.
//
// The server compresses every photograph once, to 2560 px and webp 85
// (`upload.controller.ts`). Until October 2026 the browser also squeezed every
// photo over 4 MB down to 1920 px and re-encoded it as JPEG first, so most phone
// photos were compressed twice and lost detail both times. Now it only touches
// the ones the server would refuse, and gently.

import { describe, it, expect, vi, afterEach } from "vitest";
import axios from "axios";

const imageCompression = vi.hoisted(() => vi.fn());
vi.mock("browser-image-compression", () => ({ default: imageCompression }));

const { uploadImage, UMBRAL_MB } = await import("./Upload.api");

afterEach(() => {
  vi.restoreAllMocks();
  imageCompression.mockReset();
});

const MB = 1024 * 1024;
/** A file that reports `mb` megabytes without allocating them. */
function fotoDe(mb: number): File {
  const f = new File(["x"], "foto.jpg", { type: "image/jpeg" });
  Object.defineProperty(f, "size", { value: mb * MB });
  return f;
}

describe("uploadImage", () => {
  it("sends a phone photo of a usual size untouched, so the server's is the only compression", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { path: "/1_foto.webp" } });
    const foto = fotoDe(6);

    const r = await uploadImage(foto);

    expect(r).toEqual({ ok: true, path: "/1_foto.webp" });
    expect(imageCompression).not.toHaveBeenCalled();
    expect((post.mock.calls[0][1] as FormData).get("file")).toBe(foto);
  });

  it("shrinks only what the server would refuse, keeping more pixels and quality than the server stores", async () => {
    vi.spyOn(axios, "post").mockResolvedValue({ data: { path: "/1_foto.webp" } });
    const reducida = fotoDe(5);
    imageCompression.mockResolvedValue(reducida);

    await uploadImage(fotoDe(UMBRAL_MB + 1));

    expect(imageCompression).toHaveBeenCalledTimes(1);
    const opciones = imageCompression.mock.calls[0][1];
    expect(opciones.maxSizeMB).toBe(UMBRAL_MB);
    // Above the server's 2560, so the server still does the final resize with
    // the better filter, and close to lossless, so it starts from detail.
    expect(opciones.maxWidthOrHeight).toBeGreaterThan(2560);
    expect(opciones.initialQuality).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps the threshold under the server's 10 MB ceiling, with room for the multipart wrapping", () => {
    expect(UMBRAL_MB).toBeLessThan(10);
    expect(UMBRAL_MB).toBeGreaterThanOrEqual(8);
  });
});
