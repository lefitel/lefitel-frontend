import { describe, it, expect } from "vitest";
import type { Programacion } from "../api/Programacion.api";
import {
  BORRADOR_VACIO,
  ESTADO_DE_EJECUCION,
  MAX_DESTINATARIOS,
  borradorDe,
  correosDe,
  cuandoSeEnvia,
  ENTREGA_DE_EJECUCION,
  detalleDeEjecucion,
  entregadosDe,
  etiquetaDeFormato,
  faltan,
  fechaYHora,
  horaComoTexto,
  leerHora,
  motivoDePausa,
  pedidaConActiva,
  pedidaDe,
  pesoDeArchivo,
  problemaDe,
  totalDeDestinatarios,
} from "./envios";

const programacion = (over: Partial<Programacion> = {}): Programacion => ({
  id: 5,
  id_reporte: 3,
  informe: { name: "Eventos de la semana", archivado: false },
  id_usuario: 1,
  dueno: { name: "Ana", lastname: "Pérez" },
  frecuencia: "semanal",
  dia_semana: 1,
  dia_mes: null,
  hora: 7,
  minuto: 0,
  formato: "excel",
  con_fotos: true,
  activa: true,
  motivo_pausa: null,
  fallos_seguidos: 0,
  proxima_ejecucion: "2026-10-12T11:00:00.000Z",
  destinatarios: {
    usuarios: [{ id_usuario: 20, name: "Beto", lastname: "Mamani", tieneCorreo: true }],
    correos: [
      { email: "cliente@fuera.com", deBaja: false, rechazado: false },
      { email: "baja@fuera.com", deBaja: true, rechazado: false },
    ],
  },
  ultima: null,
  ...over,
});

describe("cuandoSeEnvia", () => {
  it("reads each frequency the way a person would say it", () => {
    expect(cuandoSeEnvia({ frecuencia: "diaria", dia_semana: null, dia_mes: null, hora: 6 })).toBe("Cada día, 06:00");
    expect(cuandoSeEnvia({ frecuencia: "semanal", dia_semana: 1, dia_mes: null, hora: 7 })).toBe("Lunes, 07:00");
    expect(cuandoSeEnvia({ frecuencia: "semanal", dia_semana: 7, dia_mes: null, hora: 23 })).toBe("Domingo, 23:00");
    expect(cuandoSeEnvia({ frecuencia: "mensual", dia_semana: null, dia_mes: 1, hora: 8 })).toBe("Día 1, 08:00");
    expect(cuandoSeEnvia({ frecuencia: "diaria", dia_semana: null, dia_mes: null, hora: 0 })).toBe("Cada día, 00:00");
    expect(cuandoSeEnvia({ frecuencia: "semanal", dia_semana: 6, dia_mes: null, hora: 7, minuto: 5 })).toBe("Sábado, 07:05");
  });
});

describe("motivoDePausa", () => {
  it("has a sentence for every reason the server stores", () => {
    for (const motivo of ["manual", "fallos", "sin_permiso", "dueno_inactivo", "informe_archivado", "sin_destinatarios"]) {
      expect(motivoDePausa(motivo), motivo).toMatch(/^En pausa/);
      expect(motivoDePausa(motivo), motivo).not.toContain(motivo);
    }
    expect(motivoDePausa(null)).toBe("En pausa");
  });

  it("shows a reason it does not know rather than hiding it", () => {
    expect(motivoDePausa("algo_nuevo")).toBe("En pausa: algo_nuevo");
  });
});

describe("the words for how a run ended", () => {
  it("cover every state, and only a failure reads as one", () => {
    expect(Object.keys(ESTADO_DE_EJECUCION).sort()).toEqual(
      ["demasiado_grande", "en_curso", "enviado", "fallido", "omitido", "vacio"],
    );
    expect(Object.entries(ESTADO_DE_EJECUCION).filter(([, v]) => v.tono === "mal").map(([k]) => k)).toEqual(["fallido"]);
  });
});

describe("correosDe", () => {
  it("splits on commas, semicolons, spaces and new lines, and normalises", () => {
    expect(correosDe(" Ana@Fuera.com, beto@fuera.com;carla@fuera.com\n dora@fuera.com ")).toEqual({
      validos: ["ana@fuera.com", "beto@fuera.com", "carla@fuera.com", "dora@fuera.com"],
      malos: [],
    });
  });

  it("drops repeats and keeps what is not an address apart, to be named", () => {
    expect(correosDe("a@b.com, A@B.com, sin-arroba, a@b")).toEqual({ validos: ["a@b.com"], malos: ["sin-arroba", "a@b"] });
  });

  it("finds nothing in an empty box", () => {
    expect(correosDe("  \n ")).toEqual({ validos: [], malos: [] });
  });
});

describe("the form", () => {
  it("starts with nothing chosen and says what is missing by the names on screen", () => {
    expect(faltan(BORRADOR_VACIO)).toEqual(["Informe", "Destinatarios"]);
    expect(faltan({ ...BORRADOR_VACIO, id_reporte: 3, usuarios: [2] })).toEqual([]);
    expect(faltan({ ...BORRADOR_VACIO, id_reporte: 3, correos: "a@b.com" })).toEqual([]);
  });

  it("does not count an address that is not one as a recipient", () => {
    const b = { ...BORRADOR_VACIO, id_reporte: 3, correos: "no-es-correo" };
    expect(totalDeDestinatarios(b)).toBe(0);
    expect(faltan(b)).toEqual(["Destinatarios"]);
    expect(problemaDe(b)).toBe("No es una dirección válida: no-es-correo");
  });

  it("names every bad address at once", () => {
    expect(problemaDe({ ...BORRADOR_VACIO, correos: "uno, dos, a@b.com" })).toBe("No son direcciones válidas: uno, dos");
  });

  it("stops at the server's ceiling, counting accounts and addresses together", () => {
    const justo = { ...BORRADOR_VACIO, usuarios: Array.from({ length: MAX_DESTINATARIOS - 1 }, (_, i) => i + 1), correos: "a@b.com" };
    expect(problemaDe(justo)).toBeNull();
    expect(problemaDe({ ...justo, correos: "a@b.com, c@d.com" })).toMatch(/como máximo 10 destinatarios, y este tiene 11/);
  });
});

describe("pedidaDe", () => {
  const lleno = { ...BORRADOR_VACIO, id_reporte: 3, usuarios: [2], correos: "A@B.com", dia_semana: 4, dia_mes: 15 };

  it("sends the day that belongs to the frequency and null for the other", () => {
    expect(pedidaDe({ ...lleno, frecuencia: "semanal" })).toMatchObject({ dia_semana: 4, dia_mes: null });
    expect(pedidaDe({ ...lleno, frecuencia: "mensual" })).toMatchObject({ dia_semana: null, dia_mes: 15 });
    expect(pedidaDe({ ...lleno, frecuencia: "diaria" })).toMatchObject({ dia_semana: null, dia_mes: null });
  });

  it("never asks for photographs in a PDF", () => {
    expect(pedidaDe({ ...lleno, formato: "pdf", con_fotos: true }).con_fotos).toBe(false);
    expect(pedidaDe({ ...lleno, formato: "excel", con_fotos: true }).con_fotos).toBe(true);
  });

  it("sends the recipients as the server reads them", () => {
    expect(pedidaDe(lleno).destinatarios).toEqual({ usuarios: [2], correos: ["a@b.com"] });
  });
});

describe("a time as it is typed", () => {
  it.each([
    ["7", 7, 0], ["07", 7, 0], ["23", 23, 0], ["0", 0, 0],
    ["7:30", 7, 30], ["07:30", 7, 30], ["7.30", 7, 30], ["730", 7, 30], ["0730", 7, 30],
    [" 19:45 ", 19, 45], ["23:59", 23, 59], ["00:00", 0, 0],
  ])("reads %j", (texto, hora, minuto) => {
    expect(leerHora(texto)).toEqual({ hora, minuto });
  });

  it.each(["", "24", "24:00", "7:60", "7:5", "7:", ":30", "7:300", "siete", "7 30", "-1", "12:3o"])(
    "does not take %j for a time",
    (texto) => expect(leerHora(texto)).toBeNull(),
  );

  it("is written back with two digits each side, and reads what it wrote", () => {
    expect(horaComoTexto(7, 5)).toBe("07:05");
    expect(horaComoTexto(7)).toBe("07:00");
    for (const [h, m] of [[0, 0], [9, 9], [23, 59]]) expect(leerHora(horaComoTexto(h, m))).toEqual({ hora: h, minuto: m });
  });
});

describe("an existing schedule in the form", () => {
  it("comes back as it was saved", () => {
    expect(borradorDe(programacion())).toEqual({
      id_reporte: 3,
      frecuencia: "semanal",
      dia_semana: 1,
      dia_mes: 1,
      hora: 7,
      minuto: 0,
      formato: "excel",
      con_fotos: true,
      activa: true,
      usuarios: [20],
      correos: "cliente@fuera.com",
    });
  });

  it("leaves an unsubscribed address out of the box: it cannot be written to again", () => {
    expect(borradorDe(programacion()).correos).not.toContain("baja@fuera.com");
  });

  it("round-trips: saving without touching anything asks for the same schedule", () => {
    expect(pedidaDe(borradorDe(programacion()))).toEqual({
      id_reporte: 3,
      frecuencia: "semanal",
      dia_semana: 1,
      dia_mes: null,
      hora: 7,
      minuto: 0,
      formato: "excel",
      con_fotos: true,
      activa: true,
      destinatarios: { usuarios: [20], correos: ["cliente@fuera.com"] },
    });
  });
});

describe("pedidaConActiva", () => {
  it("flips only whether it runs", () => {
    const original = pedidaDe(borradorDe(programacion()));
    expect(pedidaConActiva(programacion(), false)).toEqual({ ...original, activa: false });
    expect(pedidaConActiva(programacion({ activa: false }), true)).toEqual({ ...original, activa: true });
  });
});

describe("how a run reads, in the dialog's history and in the screen's", () => {
  const corrida = (over: Partial<Parameters<typeof detalleDeEjecucion>[0]> = {}) => ({
    estado: "enviado" as const, detalle: null, filas: null, bytes: null, ...over,
  });

  it("writes the instant it was due in Bolivia's time, day first, no seconds", () => {
    expect(fechaYHora("2026-10-05T11:00:00.000Z")).toMatch(/^0?5\/10,? 07:00$/);
    // Midnight UTC is still the evening before in La Paz.
    expect(fechaYHora("2026-10-06T02:30:00.000Z")).toMatch(/^0?5\/10,? 22:30$/);
  });

  it("writes a file's weight in KB below a megabyte and in MB above, and nothing for no file", () => {
    expect(pesoDeArchivo(null)).toBeNull();
    expect(pesoDeArchivo(98304)).toBe("96 KB");
    expect(pesoDeArchivo(10)).toBe("1 KB");
    expect(pesoDeArchivo(3 * 1024 * 1024)).toBe("3.0 MB");
  });

  it("says the server's own sentence first", () => {
    expect(detalleDeEjecucion(corrida({ estado: "fallido", detalle: "La consulta tardó demasiado." }))).toBe("La consulta tardó demasiado.");
  });

  it("says how big a sent run was when the server said nothing", () => {
    expect(detalleDeEjecucion(corrida({ filas: 214, bytes: 98304 }))).toBe("214 filas · 96 KB");
    expect(detalleDeEjecucion(corrida({ filas: 1200, bytes: null }))).toMatch(/^1[.,\s\u00a0]?200 filas$/);
    expect(detalleDeEjecucion(corrida({ filas: null, bytes: 2048 }))).toBe("2 KB");
  });

  it("says nothing for a sent run with neither figure, nor for one that has nothing to add", () => {
    expect(detalleDeEjecucion(corrida())).toBeFalsy();
    expect(detalleDeEjecucion(corrida({ estado: "omitido" }))).toBeNull();
    expect(detalleDeEjecucion(corrida({ estado: "fallido" }))).toBeNull();
  });

  it("says that an empty report still sent a notice", () => {
    expect(detalleDeEjecucion(corrida({ estado: "vacio" }))).toBe("Se envió un aviso");
  });

  it("counts the recipients reached out of those tried, and shows a dash for a run that was skipped", () => {
    expect(entregadosDe({ estado: "enviado", enviados: 2, no_enviados: 1 })).toBe("2 de 3");
    expect(entregadosDe({ estado: "fallido", enviados: 0, no_enviados: 3 })).toBe("0 de 3");
    expect(entregadosDe({ estado: "omitido", enviados: 0, no_enviados: 0 })).toBe("—");
  });

  it("names the two formats the way the schedules table does", () => {
    expect(etiquetaDeFormato("excel")).toBe("Excel");
    expect(etiquetaDeFormato("pdf")).toBe("PDF");
  });
});

describe("what became of a recipient", () => {
  it("has a word and a colour for each of the four results the server writes", () => {
    expect(Object.keys(ENTREGA_DE_EJECUCION).sort()).toEqual(["entregado", "no_enviado", "rechazado", "sin_cupo"]);
    expect(ENTREGA_DE_EJECUCION.entregado).toEqual({ etiqueta: "Entregado", tono: "bien" });
    expect(ENTREGA_DE_EJECUCION.rechazado).toEqual({ etiqueta: "Rechazado", tono: "mal" });
    expect(ENTREGA_DE_EJECUCION.no_enviado).toEqual({ etiqueta: "No enviado", tono: "mal" });
    // Held back by the day's ceiling: nobody's fault, but not delivered either.
    expect(ENTREGA_DE_EJECUCION.sin_cupo).toEqual({ etiqueta: "Sin cupo", tono: "aviso" });
  });
});
