import { readFileSync } from "node:fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

/**
 * The version the running app reports is read from package.json at build
 * time, so the two cannot drift. A string typed into a component instead
 * goes stale on the first release nobody remembers to update it, and a
 * version that lies is worse than no version at all — it sends you looking
 * for a bug in code the user is not running.
 */
const version = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8")
).version as string;

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    /**
     * Installable on a phone, and honest about being out of date.
     *
     * **`prompt` is who applies the update, not whether it is applied.** It used
     * to mean "the person decides, and may decide never" — which is what task E4
     * of the API standard set out to end: after the deployment cut the server and
     * the client change contract together, so a build somebody keeps for three
     * weeks is not an old build, it is a broken one.
     *
     * The literal answer to that is `autoUpdate`, and it is the wrong one here:
     * the plugin then reloads the page the moment a new build lands, which is
     * precisely the pole form swapped out from under a field worker that this
     * comment used to warn about. `prompt` is the only setting that lets the
     * application choose the *moment*, so it stays — and <UpdatePrompt /> now
     * applies the update on its own at the first screen change, where a reload
     * costs nothing because the screen was being left anyway. The window shrinks
     * from "until somebody taps Actualizar" to "until they tap anything".
     *
     * Nothing from the API is cached. The service worker holds the shell —
     * scripts, styles, fonts, icons — and every request for a pole or an event
     * still goes to the network. A stale spinner is recoverable; a stale pole
     * shown as current is not.
     */
    VitePWA({
      registerType: "prompt",
      manifest: {
        id: "/",
        name: "Osefi srl",
        short_name: "Osefi",
        description: "Gestión de postes, eventos y reportes.",
        lang: "es",
        // Not "/": that is the public landing page, and an installed app that
        // opens on marketing copy has wasted the icon.
        start_url: "/app/home",
        scope: "/",
        display: "standalone",
        background_color: "#f1f5fa",
        theme_color: "#f1f5fa",
        /**
         * Two sets, and the distinction matters. `any` is the icon as drawn,
         * used where the launcher shows it whole. `maskable` is for Android,
         * which crops every icon to whatever shape the launcher wants — a
         * circle, a squircle, a teardrop — and only guarantees the middle 80%
         * survives. Declaring the plain icon as maskable would have had the
         * logo shaved off top and bottom, since it fills its canvas edge to
         * edge; the maskable pair is the same logo backed by the brand colour
         * and scaled to sit inside that circle. Both are opaque, because a
         * transparent maskable shows the crop as a hole.
         */
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/android-chrome-maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/android-chrome-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Every route is served by index.html; Vercel already rewrites this way.
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        // The main bundle is over 3 MB and workbox refuses anything past 2 MB
        // by default — it would skip the one file the whole app is made of and
        // say nothing.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  /**
   * Fail instead of moving to the next free port.
   *
   * Vite's default is to shrug: 5173 taken, start on 5174, print the new
   * address and carry on. That is fine for a static site and wrong here,
   * because 5173 is not an arbitrary number — it is the one origin the API
   * grants credentialed access to (`CORS_ORIGIN` in `api/.env`, read by
   * `allowedOrigins` in `api/src/config/security.ts`).
   *
   * A second dev server on 5174 therefore serves an application that can
   * never authenticate, and does it silently in the worst possible way. The
   * session cookie still travels — cookies ignore ports — so the API answers
   * `GET /api/auth/me` with a clean 200 and logs it as one. The browser then
   * discards that response before any code sees it, because it carries no
   * `Access-Control-Allow-Origin` for 5174. To the app that is indistinguishable
   * from a dead server: it asks whether there is a session, hears nothing,
   * concludes there is none, and shows the login form to somebody who is
   * logged in. Nothing turns red at either end.
   *
   * `strictPort` turns that into "Port 5173 is already in use" at startup,
   * which is the truth and takes ten seconds to act on. The alternative fix —
   * adding 5174 to `CORS_ORIGIN` — makes the broken twin work rather than
   * stopping it from existing, and widens the credentialed origin list to do it.
   */
  server: {
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  /**
   * Workers are built as ES modules, because the only one there is — MapLibre's,
   * imported in `src/components/map/BaseMap.tsx` — is started by the library
   * with `new Worker(url, { type: "module" })`. Vite's default for workers is a
   * classic script.
   */
  worker: {
    format: "es",
  },
  /**
   * Strip the logging out of production builds.
   *
   * This used to be `esbuild: { drop: [...] }`, which Vite 8 silently stopped
   * honouring: the bundler is Rolldown now, esbuild is not in the pipeline, and
   * dropping calls moved from the transform step to the minifier. Nothing
   * warned — the option simply had no effect and nine `console.log` calls went
   * out with the build. `mangle` and `module` are spelled out because naming
   * the object at all replaces Vite's defaults for it.
   */
  build: {
    rolldownOptions:
      mode === "production"
        ? {
            output: {
              minify: {
                module: true,
                mangle: true,
                compress: { dropConsole: true, dropDebugger: true },
              },
            },
          }
        : undefined,
  },
}));
