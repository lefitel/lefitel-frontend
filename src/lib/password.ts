/**
 * The password rule, in one place, so a screen can refuse before the attempt
 * costs something.
 *
 * **Why this file exists at all.** Three screens in this application let
 * somebody choose a password — the profile page, the user detail page and the
 * "nuevo usuario" sheet — and until now one of them checked the length against
 * a `6` typed into the middle of a handler, and the other two checked nothing.
 * The server has always demanded twelve. A screen that lets the button be
 * pressed on eight characters is not merely useless, it is expensive: the
 * account's own password confirmations are rationed to
 * `PASSWORD_CONFIRM_LIMIT` per quarter of an hour, the same ration covers
 * renaming yourself *and* changing your password, and the token is spent before
 * the server has looked at the new password at all. So somebody who reacts to
 * "at least 12 characters" the way people do — nine, then ten, then eleven —
 * runs out of confirmations while doing nothing wrong, and is then locked out
 * of both operations for fifteen minutes by a message that only says to wait.
 *
 * **The number here is a mirror, and the original lives in the API**
 * (`api/src/config/security.ts`, `PASSWORD_MIN_LENGTH`). Two repositories
 * cannot share a constant, so what is possible is that the copy be in exactly
 * one place on this side and that its drifting be loud: `password.test.ts`
 * reads that file off disk and fails if the two numbers stop agreeing, whenever
 * the API is checked out beside this repository. That check cannot run where it
 * is not — a CI job or a Vercel build that only has `web` — so it is a guard for
 * the tree where the change would actually be made, not a proof for all of them.
 *
 * **Only the length, and deliberately not the rest of the policy.** The server
 * also refuses a couple of dozen common passwords (`api/src/utils/password.ts`),
 * and that list is *not* copied here. It would be twenty-four strings duplicated
 * across two repositories to save a single wasted attempt — the person picks
 * another password and moves on — whereas the length rule is the one that costs
 * an attempt per correction. The server stays the authority for every rule, and
 * the sentence it sends back is what the screens show; this only stops the
 * refusals that are free to predict.
 */

/** Mirror of `PASSWORD_MIN_LENGTH` in `api/src/config/security.ts`. */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Why this password is too short for the server to accept, or null if it is not.
 *
 * Measured exactly the way the server measures it, and both details are load
 * bearing rather than tidiness:
 *
 * - On the **trimmed** password. `"clave1      "` is a six-character secret in a
 *   twelve-character costume; the server trims before counting, so a screen that
 *   did not would wave it through and spend a confirmation on a 400.
 * - Counting **code points** and not `.length`, which counts UTF-16 code units.
 *   Six emoji are twelve units and six characters: `.length` says yes, the
 *   server says no, and the token is gone.
 *
 * The sentence is the server's own, word for word, so the person reads the same
 * thing whichever side refused.
 */
export function passwordLengthError(pass: string): string | null {
  if ([...pass.trim()].length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  return null;
}
