import type { Metadata } from "next";
import { sans, mono, display } from "./fonts";
import { AppShell } from "./_components/AppShell";
import { ThemeProvider } from "./_components/ThemeProvider";
import { MotionProvider } from "./_components/MotionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Verdé",
  description: "Understand and shrink your carbon footprint.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${display.variable}`}
    >
      <body>
        <ThemeProvider>
          <MotionProvider>
            <AppShell>{children}</AppShell>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
