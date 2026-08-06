import { describe, it, expect } from "vitest";
import { AxiosError, AxiosHeaders } from "axios";
import { filenameFromDisposition, mensajeDeError, mensajeDeErrorAsync } from "./generador.api";

describe("filenameFromDisposition", () => {
  it("reads the encoded form, which is the one that carries accents", () => {
    const header =
      `attachment; filename="Reporte de da_os_06-08-2026.xlsx"; ` +
      `filename*=UTF-8''Reporte%20de%20da%C3%B1os_06-08-2026.xlsx`;

    expect(filenameFromDisposition(header, "excel")).toBe("Reporte de daños_06-08-2026.xlsx");
  });

  it("falls back to the plain form when there is no encoded one", () => {
    expect(filenameFromDisposition('attachment; filename="reporte.pdf"', "pdf")).toBe("reporte.pdf");
    expect(filenameFromDisposition("attachment; filename=reporte.pdf", "pdf")).toBe("reporte.pdf");
  });

  it("names the file by format when the header never arrives", () => {
    // Which happens whenever CORS does not expose Content-Disposition: the
    // browser hides it and every download would otherwise be nameless.
    expect(filenameFromDisposition(undefined, "excel")).toBe("reporte.xlsx");
    expect(filenameFromDisposition(null, "pdf")).toBe("reporte.pdf");
    expect(filenameFromDisposition("attachment", "excel")).toBe("reporte.xlsx");
  });

  it("does not lose the download to a malformed header", () => {
    // A stray percent is not valid percent-encoding and throws on decode.
    expect(filenameFromDisposition("attachment; filename*=UTF-8''100%", "pdf"))
      .toBe("reporte.pdf");
  });
});

const axiosErrorWith = (data: unknown): AxiosError => {
  const error = new AxiosError("fallo");
  error.response = {
    data, status: 400, statusText: "Bad Request",
    headers: new AxiosHeaders(), config: { headers: new AxiosHeaders() },
  };
  return error;
};

describe("mensajeDeError", () => {
  it("prefers the sentence the server wrote for the user", () => {
    expect(mensajeDeError(axiosErrorWith({ message: "Filtre el reporte." }), "otra cosa"))
      .toBe("Filtre el reporte.");
  });

  it("falls back when there is nothing usable", () => {
    for (const data of [{}, { message: "" }, { message: "   " }, null, "texto"]) {
      expect(mensajeDeError(axiosErrorWith(data), "de reserva")).toBe("de reserva");
    }
    expect(mensajeDeError(new Error("normal"), "de reserva")).toBe("de reserva");
  });
});

describe("mensajeDeErrorAsync", () => {
  it("reads the message out of a Blob, which is how a failed download arrives", async () => {
    // The request asked for a blob, so the JSON error body comes back as one.
    const blob = new Blob([JSON.stringify({ message: "Ya hay una exportación en curso." })]);

    expect(await mensajeDeErrorAsync(axiosErrorWith(blob), "de reserva"))
      .toBe("Ya hay una exportación en curso.");
  });

  it("falls back when the blob is not the JSON we expect", async () => {
    for (const body of ["no es json", "", JSON.stringify({ otra: "cosa" })]) {
      expect(await mensajeDeErrorAsync(axiosErrorWith(new Blob([body])), "de reserva"))
        .toBe("de reserva");
    }
  });

  it("behaves like the synchronous one for anything that is not a blob", async () => {
    expect(await mensajeDeErrorAsync(axiosErrorWith({ message: "Formato no válido." }), "x"))
      .toBe("Formato no válido.");
    expect(await mensajeDeErrorAsync(new Error("normal"), "de reserva")).toBe("de reserva");
  });
});
