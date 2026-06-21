"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * ThemeProvider — system-aware, persisted light/dark theming.
 *
 * Verdé's tokens switch on `[data-theme="dark"]` on <html>, so next-themes is
 * configured to write the `data-theme` attribute (not a `class`). `value` maps
 * the theme name to that attribute value explicitly.
 *
 *  - defaultTheme "system": respects the OS preference (a user checking their
 *    footprint at night gets dark automatically — the documented physical scene).
 *  - enableSystem + the user's explicit choice is persisted to localStorage.
 *  - SSR-safe: next-themes injects a tiny pre-hydration script; the matching
 *    `suppressHydrationWarning` lives on <html> in layout.tsx so the server's
 *    `data-theme="light"` default never trips a hydration mismatch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      value={{ light: "light", dark: "dark" }}
    >
      {children}
    </NextThemesProvider>
  );
}
