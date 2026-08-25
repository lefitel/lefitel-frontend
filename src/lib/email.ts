/**
 * `n***@dominio.com` — enough for an administrator to recognise the address
 * without a second click, never enough to reuse it.
 *
 * **Why this exists at all.** Task 10 puts a "recovery address" column on the
 * Seguridad list so an administrator can spot, across the whole staff, who
 * verified a mistyped mailbox months ago and will only find out the day it
 * closes. That column has to show *something* about the address — a bare
 * badge saying "verified" does not let anyone notice "that's not even close
 * to a real domain" — but the full address does not belong in a table an
 * administrator scrolls past forty times a day; the profile page is where its
 * owner sees it in full.
 *
 * **One function, not three call sites.** The same shape of judgement call
 * shows up wherever a recovery address needs partial display, and a masking
 * rule improvised at each of those sites is a rule that quietly drifts three
 * ways. This is the only one, and `email.test.ts` pins the cases a
 * hand-written version gets wrong.
 *
 * **Mirrors, and deliberately does not import, `maskEmail` in
 * `api/src/auth/securityNotice.ts`.** Two repositories, so the analysis is
 * borrowed and the code is not: `lastIndexOf("@")` is what makes several `@`
 * signs harmless (everything up to the last one becomes "local", never
 * inspected past its first character), and there is no assumption that the
 * domain contains a dot — it is copied through as-is, so `isaias@localhost`
 * masks the same way an ordinary address does instead of throwing on a
 * `split(".")` that finds nothing to split.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  // No `@` at all, or one at either end: not an address this can reason
  // about, so nothing is revealed rather than guessed at.
  if (at <= 0 || at === email.length - 1) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
}
