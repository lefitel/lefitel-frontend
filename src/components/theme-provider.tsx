import { createContext, useContext, useEffect, useMemo, useState } from "react"

type Theme = "dark" | "light" | "system"
type ResolvedTheme = "dark" | "light"

const DARK_QUERY = "(prefers-color-scheme: dark)"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  /** What the user picked, which may be "system". */
  theme: Theme
  /** What is actually on screen, with "system" already resolved. Anything
   * that needs to know whether it is painting light or dark must read this
   * instead of resolving "system" on its own. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
)

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia?.(DARK_QUERY).matches ? "dark" : "light"
}

function readStoredTheme(storageKey: string): Theme | null {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : null
  } catch {
    // Private mode and blocked site data both throw on access.
    return null
  }
}

/** Matches `--background` in index.css for each scheme. */
const THEME_COLOR: Record<ResolvedTheme, string> = {
  light: "#f1f5fa",
  dark: "#080c15",
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(
    () => readStoredTheme(storageKey) ?? defaultTheme
  )
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  // The OS preference can change while the app is open. Without this listener
  // "system" stays frozen on whatever it was at mount, and anything that
  // resolves the preference itself (sonner, map tiles) drifts out of sync.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY)
    const onChange = (event: MediaQueryListEvent) =>
      setSystemTheme(event.matches ? "dark" : "light")

    setSystemTheme(query.matches ? "dark" : "light")
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  useEffect(() => {
    const root = window.document.documentElement

    root.classList.remove("light", "dark")
    root.classList.add(resolvedTheme)
    // Keeps native UI (scrollbars, date inputs, autofill) in the same theme.
    root.style.colorScheme = resolvedTheme

    /**
     * Installed on a phone, the app paints its own title and status bars from
     * this tag. A manifest carries a single `theme_color` and a static <meta>
     * can only follow the operating system — but the theme here is the user's
     * own choice and defaults to light whatever the phone is set to, so either
     * of those is wrong more often than right. This is the only place that
     * knows the answer.
     */
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[resolvedTheme])
  }, [resolvedTheme])

  const value = useMemo<ThemeProviderState>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next: Theme) => {
        try {
          localStorage.setItem(storageKey, next)
        } catch {
          // Losing persistence beats breaking the toggle.
        }
        setThemeState(next)
      },
    }),
    [theme, resolvedTheme, storageKey]
  )

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
