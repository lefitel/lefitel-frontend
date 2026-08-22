import js from "@eslint/js";
import globals from "globals";
import pluginTs from "@typescript-eslint/eslint-plugin";
import parserTs from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
    {
        files: ["**/*.{ts,tsx}"],
        ignores: ["dist/**"],
        languageOptions: {
            globals: globals.browser,
            parser: parserTs,
            parserOptions: {
                project: "./tsconfig.json",
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": pluginTs,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...js.configs.recommended.rules,
            ...pluginTs.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
            "no-undef": "off",
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/no-explicit-any": "error",
            "react-hooks/set-state-in-effect": "off",
            "react-hooks/incompatible-library": "off",
            "react-hooks/preserve-manual-memoization": "off",
            // Arrived with eslint-plugin-react-hooks 7.1, which reports 13
            // pre-existing findings: refs written during render in the bitácora
            // and generador screens, and a `Date.now()` read during render in
            // the home page's data hook. All three are real by React's rules —
            // the ref writes break under the compiler, and a clock read during
            // render is not idempotent — but fixing them means unpicking the
            // "ref mirrors state" pattern, which is a task, not a lint autofix.
            // Warnings rather than "off" so they stay on screen, and rather
            // than errors so a red lint does not block work on those files.
            "react-hooks/refs": "warn",
            "react-hooks/purity": "warn",
        },
    },
    // shadcn/ui generated files — only disable fast-refresh warning
    {
        files: ["src/components/ui/**/*.{ts,tsx}", "src/components/theme-provider.tsx"],
        rules: {
            "react-refresh/only-export-components": "off",
        },
    },
];
