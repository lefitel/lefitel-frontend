import { ShieldCheckIcon } from "lucide-react";
import PasskeysSection from "./PasskeysSection";
import TotpSection from "./TotpSection";
import RecoveryCodesSection from "./RecoveryCodesSection";

/**
 * "Segundo factor" — Tasks 19 and 20 of the 4B plan, one screen.
 *
 * **Deliberately not part of `PerfilPage.tsx`, and not built on
 * `usePerfilData`.** That hook's very first request is `searchUsuario(id)` →
 * `GET /api/usuario/:id`, which an `onboarding` session gets a 403 from —
 * `auth/sessionState.ts` only opens `/api/auth/*` for that state. Since this
 * is the one screen an account in `onboarding` has to reach to stop being
 * `onboarding`, building it on a hook that 403s in exactly that state was
 * never an option; see `docs/plans/2026-09-01-factores-mfa.md`, Task 19 Step
 * 1. Both sections below talk to `/api/auth/totp/*` and
 * `/api/auth/recovery-codes` only, through `Mfa.api.ts` — neither reads
 * `sesion.usuario` from context or asks `usePerfilData`'s endpoint for
 * anything about the account.
 *
 * **One exception, added for hallazgo E-3/F12, and it is safe under the same
 * rule.** `TotpSection` calls `comprobarToken()` — `/api/auth/me`, not
 * `/api/usuario/:id` — after a successful `confirmTotp`, to re-derive the
 * session `HomeRoute` and the sidebar read from. `/api/auth/me` is on the
 * same `/api/auth/*` allow-list this docstring already leans on, open to
 * `onboarding` (and to the `parcial` session this screen never sees), so it
 * carries none of `usePerfilData`'s 403 risk.
 *
 * **One screen, not two, even though the plan writes Tasks 19 and 20 as
 * separate units.** Recovery codes are the rescue for exactly the TOTP
 * section above them — printed for the day the phone the QR was scanned
 * into is gone — so splitting them across two routes would mean building a
 * second page shell, a second route, and a second way to get here for a
 * pair of concerns anybody managing their own second factor thinks of as
 * one visit. The total surface built is the same either way; this is a
 * layout decision, not a scope change.
 *
 * ~~Reached today only by typing `/app/segundo-factor`.~~ Not any more:
 * `App.tsx` redirects an `onboarding` session here on day 15, and
 * `PerfilAcceso.tsx` links to it. The sentence stood for a while after both
 * were wired; it is struck rather than deleted so nobody re-derives it.
 *
 * **Three sections since plan 4C, and the passkeys go first** because they
 * are the recommended method: one gesture, nothing to type, and a key only
 * signs for the domain it was created on, so a fake page cannot ask for it.
 * `PasskeysSection` talks to `/api/auth/webauthn/*` only — on the same
 * `/api/auth/*` allow-list this docstring already leans on — so it carries
 * none of `usePerfilData`'s 403 risk either.
 */
const SegundoFactorPage = () => {
  return (
    <div className="p-page w-full max-w-2xl space-y-page animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Segundo factor</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Tu huella, tu cara o un código de tu teléfono, además de tu contraseña, para que una
        contraseña filtrada no baste para entrar a tu cuenta.
      </p>

      <PasskeysSection />
      <TotpSection />
      <RecoveryCodesSection />
    </div>
  );
};

export default SegundoFactorPage;
