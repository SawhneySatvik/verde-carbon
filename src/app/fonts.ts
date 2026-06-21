import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";

/**
 * Verdé type system.
 *
 * Paired on a CONTRAST axis, not similarity:
 *  - Geist Sans (humanist sans) → body, UI, secondary headings.
 *  - Space Grotesk (geometric grotesque) → display + structural headings.
 *    A distinctive wide grotesque that carries the "Soft Structuralism" voice
 *    (massive, confident display type) without touching the banned Inter/Roboto
 *    defaults. Loaded from next/font/google so nothing is self-hosted.
 *  - Geist Mono → all figures (tabular numerals) so carbon numbers align.
 *
 * Display is subset to latin and only the weights we use (500/600/700) to keep
 * the font payload — and therefore the bundle — small.
 */

export const sans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

export const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});
