// La frase de `sin-factor-reciente` cuando el servidor dice con qué se puede
// cubrir — plan 4C, Tarea 8 en el servidor y Tarea 11 aquí.

import { describe, it, expect } from "vitest";
import { describeMetodos, describeStepUpError, MOTIVO_SIN_FACTOR_RECIENTE } from "./stepUp";

describe("describeMetodos", () => {
  // Un servidor anterior no manda el campo: la ventana cae en la frase de
  // siempre, que promete un código de recuperación a todo el mundo. Es el
  // único caso en el que esa promesa se sigue haciendo a ciegas.
  it("no dice nada cuando el servidor no dijo nada, para caer en la frase de siempre", () => {
    expect(describeMetodos(undefined)).toBeNull();
    expect(describeStepUpError(MOTIVO_SIN_FACTOR_RECIENTE, null)).toContain("código de recuperación");
  });

  // 🔴 El encierro que la tarea existe para cerrar: a quien sólo tiene llave
  // no se le puede mandar a buscar un código que no tiene.
  it("con sólo la llave, pide la llave y no promete un código", () => {
    const frase = describeMetodos(["passkey"]);
    expect(frase).toContain("llave de acceso");
    expect(frase).not.toContain("código");
  });

  it("con sólo el código de la aplicación, pide el código y nada más", () => {
    const frase = describeMetodos(["totp"]);
    expect(frase).toContain("código de tu aplicación");
    expect(frase).not.toContain("llave");
    expect(frase).not.toContain("recuperación");
  });

  it("con las dos, ofrece las dos en el orden en que llegaron", () => {
    const frase = describeMetodos(["passkey", "totp"]) ?? "";
    expect(frase.indexOf("llave")).toBeLessThan(frase.indexOf("código de tu aplicación"));
  });

  // Plan 4E: el correo verificado es un método más, no la rama «no lo conozco».
  it("con sólo el correo, pide un código al correo y no promete otra cosa", () => {
    const frase = describeMetodos(["correo"]) ?? "";
    expect(frase).toContain("pide un código a tu correo");
    expect(frase).not.toContain("llave");
    expect(frase).not.toContain("aplicación");
    expect(frase).not.toContain("recuperación");
    expect(frase).not.toContain("Recarga");
  });

  it("con la aplicación y el correo, nombra las dos en ese orden", () => {
    const frase = describeMetodos(["totp", "correo"]) ?? "";
    expect(frase.indexOf("código de tu aplicación")).toBeLessThan(frase.indexOf("código a tu correo"));
    expect(frase).toMatch(/aplicación o pide/);
  });

  it("con tres métodos, los separa con comas y cierra con «o»", () => {
    const frase = describeMetodos(["passkey", "totp", "correo"]) ?? "";
    expect(frase).toContain("usa tu llave de acceso, escribe el código de tu aplicación o pide un código a tu correo");
  });

  it("con el correo y códigos de recuperación, promete también el de recuperación", () => {
    expect(describeMetodos(["correo", "codigo"])).toContain("También sirve un código de recuperación");
  });

  // «Código» es lo que se acepta, no un factor: sólo se nombra cuando el
  // servidor dice que queda alguno sin gastar.
  it("sólo promete un código de recuperación cuando queda alguno", () => {
    expect(describeMetodos(["passkey", "codigo"])).toContain("código de recuperación");
    expect(describeMetodos(["passkey"])).not.toContain("recuperación");
  });

  it("con sólo códigos de recuperación, los pide como único camino", () => {
    expect(describeMetodos(["codigo"])).toContain("códigos de recuperación");
  });

  // 🔴 Lista vacía no es «no lo sé»: es «esta cuenta tiene un factor y ninguno
  // le sirve ahora mismo». El formulario de siempre sería teclear contra un 503.
  it("con la lista vacía, dice a quién avisar en vez de pintar un formulario sin salida", () => {
    const frase = describeMetodos([]);
    expect(frase).toContain("administrador");
    expect(frase).not.toContain("código");
  });

  // El servidor puede aprender un cuarto método antes que esta pantalla: se
  // ignora, no se rompe.
  it("ignora un método que no reconoce y sigue con los que sí", () => {
    expect(describeMetodos(["passkey", "un-metodo-futuro"])).toContain("llave de acceso");
  });

  // Ninguno de los que llegaron se sabe dibujar: no es «no lo sé» (eso es el
  // campo ausente), es «el servidor va por delante de esta pantalla». La
  // ventana no tendrá formulario, y la frase tiene que decir qué hacer.
  it("con sólo métodos que no conoce, dice que hay que recargar en vez de prometer un código", () => {
    const frase = describeMetodos(["un-metodo-futuro"]);
    expect(frase).toContain("Recarga");
    expect(frase).not.toContain("código");
  });
});
