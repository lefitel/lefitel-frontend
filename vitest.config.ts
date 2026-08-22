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
  },
});
