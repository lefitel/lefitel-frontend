// Set before Vite reads anything, and that ordering is the point.
//
// The suite is a deploy gate now, and Vercel runs the build with
// `NODE_ENV=production`. Vitest only defaults that variable when it is unset, so
// there it stays "production" — and Vite then resolves the browser conditions
// and externalises Node built-ins, which stops `src/api/http.test.ts` from even
// loading ("No such built-in module: node:"). Measured, not guessed: with the
// variable left alone that file collects zero tests and the gate reports a
// failure that has nothing to do with the code.
//
// A `test.env` entry does not cover it — that lands after the transform — and an
// inline `NODE_ENV=test` in the npm script is not portable to Windows without a
// new dependency. Assigning it here runs before Vite's config resolution and
// covers every way the suite can be started.
process.env.NODE_ENV = "test";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import path from "path";

const version = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
).version as string;

export default defineConfig({
  plugins: [react()],
  // Mirrors vite.config.ts; without it the constant is undefined under test.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "virtual:pwa-register/react": path.resolve(import.meta.dirname, "./src/test/pwa-register-stub.ts"),
    },
  },
  test: {
    env: {
      // Pinned, because a date test cannot fail in UTC.
      //
      // The generator's filters parse "yyyy-MM-dd" with `parseISO` so the
      // day cannot shift; `new Date(...)` would read it as UTC midnight and
      // hand back the day before — west of Greenwich only. The regression
      // test for that is inert wherever the offset is zero, and the build
      // that gates deployment runs on a UTC runner: the guard would have
      // been green on the one machine that matters.
      TZ: "America/La_Paz",
    },
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "dist/**"],
    /**
     * Vitest defaults to 5 s, which is generous for a unit test and thin for
     * what most of the tests here actually are: a screen rendered into jsdom,
     * a click, and two or three `waitFor`s over mocked round trips.
     * `UsuarioDetallePage.test.tsx` alone spends fourteen seconds across ten
     * such cases *on its own*, so each one already sits within a couple of
     * seconds of the ceiling before anything else is competing for the
     * machine.
     *
     * Measured, not guessed: with the suite at 424 tests across 32 files, three
     * consecutive full runs failed 5, 4 and 2 tests — a different set each
     * time, every one of them a timeout rather than a failed assertion, and
     * every one passing on its own. That is not flakiness in the tests, it is
     * a ceiling set for a different kind of test.
     *
     * Raised rather than pinned per file so the next slow screen does not have
     * to rediscover this. It is not a licence for slow tests: a test that
     * genuinely hangs still fails, fifteen seconds later instead of five.
     */
    testTimeout: 15000,
  },
});
