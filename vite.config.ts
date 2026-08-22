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
     * `prompt` rather than `autoUpdate` on purpose: a field worker halfway
     * through filling in a pole should not have the page swapped under them
     * because a deploy landed. The new build waits, <UpdatePrompt /> offers it,
     * and they take it when they are ready.
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
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
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
