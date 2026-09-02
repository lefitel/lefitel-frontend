import { ShieldCheckIcon } from "lucide-react";
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
 * **Reached today only by typing `/app/segundo-factor`.** Making the day-15
 * redirect and the `/app/perfil` link land here is the rest of this plan's
 * Group 6 (Tasks 21 and 22) — see this task's own report for why that
 * wiring belongs to whoever owns `HomeRoute` and `PerfilAcceso.tsx`'s
 * routing changes, not to this screen itself.
 */
const SegundoFactorPage = () => {
  return (
    <div className="pt-4 px-6 md:px-8 pb-6 md:pb-8 w-full max-w-2xl space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Segundo factor</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Un código de tu teléfono, además de tu contraseña, para que una contraseña filtrada no baste
        para entrar a tu cuenta.
      </p>

      <TotpSection />
      <RecoveryCodesSection />
    </div>
  );
};

export default SegundoFactorPage;
