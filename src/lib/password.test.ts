// The one number that has to agree with the server, and the ways of measuring
// it that look right and are not.
//
// What makes this worth testing rather than eyeballing: every failure mode here
// is silent on this side and expensive on the other. A client rule looser than
// the server's lets the button be pressed on a password the server refuses, and
// that refusal costs one of the five confirmations the account gets per quarter
// hour — shared with renaming itself, and charged before the server has even
// looked at the new password. Nothing on screen connects "I was told to use
// twelve characters" to "now I cannot change my password for fifteen minutes".
// A rule stricter than the server's is the mirror image: it refuses passwords
// that were fine.

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PASSWORD_MIN_LENGTH, passwordLengthError } from "./password";

describe("passwordLengthError", () => {
  it("refuses one character short and accepts exactly the minimum", () => {
    // The boundary in both directions. An off-by-one the strict way blocks a
    // password the server would have taken; the loose way spends a token on a
    // 400.
    expect(passwordLengthError("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(
      /al menos 12 caracteres/
    );
    expect(passwordLengthError("a".repeat(PASSWORD_MIN_LENGTH))).toBeNull();
    expect(passwordLengthError("a".repeat(PASSWORD_MIN_LENGTH + 40))).toBeNull();
  });

  it("refuses the eight-character password this rule exists for", () => {
    // The measured case: the profile page checked `< 6`, so this was pressable,
    // and the server answered "La contraseña debe tener al menos 12
    // caracteres." having already charged for the attempt.
    expect(passwordLengthError("clave123")).not.toBeNull();
  });

  it("does not count padding, because the server does not either", () => {
    // Six characters wearing a twelve-character costume. `pass.length` says
    // twelve; `api/src/utils/password.ts` trims first and says six.
    expect(passwordLengthError("clave1      ")).not.toBeNull();
    // And spaces *between* words are not padding: they survive the trim on both
    // sides and count. "el poste de la esquina" is a perfectly good password.
    expect(passwordLengthError("el poste de la esquina")).toBeNull();
    expect(passwordLengthError("  el poste de la esquina  ")).toBeNull();
  });

  it("counts characters and not UTF-16 units", () => {
    // Six emoji are twelve code units. This is the assertion that fails against
    // a `.length` implementation — which is what every screen in this
    // application used before — while every other test here passes.
    expect("😀".repeat(6)).toHaveLength(12);
    expect(passwordLengthError("😀".repeat(6))).not.toBeNull();
    // Twelve of them are twelve characters, and fine.
    expect(passwordLengthError("😀".repeat(12))).toBeNull();
  });

  it("says nothing about a password that is only weak, and leaves that to the server", () => {
    // `contraseña123` is on the server's list of common passwords and will be
    // refused there. That list is deliberately not copied into this repository —
    // see the file's own comment — so this function must not pretend to know.
    // Asserted rather than left implicit, so that copying the list here becomes
    // a change that has to argue with a test instead of a quiet drift.
    expect(passwordLengthError("contraseña123")).toBeNull();
  });
});

describe("the number the server actually enforces", () => {
  it("matches PASSWORD_MIN_LENGTH in the api repository", (ctx) => {
    /**
     * The only mechanism available for keeping two repositories' copies of one
     * constant together, and it is worth being honest about its edges.
     *
     * It reads `api/src/config/security.ts` off disk, so it only runs where the
     * API is checked out next to this repository — a developer's tree, which is
     * exactly where somebody would change the number. A build that has only
     * `web` skips it, visibly, rather than passing.
     *
     * A file that exists but no longer declares the constant is a **failure**,
     * not a skip: it means the authority moved and this mirror can no longer be
     * checked, which is the moment somebody should look rather than the moment
     * to go quiet.
     */
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const configDelServidor = path.resolve(aqui, "../../../api/src/config/security.ts");

    if (!existsSync(configDelServidor)) {
      ctx.skip(`sin el repositorio api al lado no se puede comprobar (${configDelServidor})`);
      return;
    }

    const fuente = readFileSync(configDelServidor, "utf-8");
    const declarado = /export const PASSWORD_MIN_LENGTH\s*=\s*(\d+)/.exec(fuente);

    expect(
      declarado,
      `PASSWORD_MIN_LENGTH ya no se declara en ${configDelServidor}: ` +
        "la fuente de verdad se movió y este espejo dejó de estar comprobado."
    ).not.toBeNull();
    expect(
      Number(declarado![1]),
      "el servidor y esta pantalla exigen longitudes distintas: " +
        "web/src/lib/password.ts tiene que seguir a api/src/config/security.ts."
    ).toBe(PASSWORD_MIN_LENGTH);
  });
});
