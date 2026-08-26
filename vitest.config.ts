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
