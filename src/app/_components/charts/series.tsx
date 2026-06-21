import type { Category } from "@core/schemas";

/**
 * Data-visualisation series metadata. Color is a SECONDARY
 * channel: every series also carries a pattern, a marker SHAPE, and a dash style
 * so charts are distinguishable in grayscale and for all colour-vision types
 * (not color alone). Direct text labels are rendered by the chart
 * components; this module supplies the non-colour encodings + reusable SVG defs.
 *
 * The three logged categories (transport / energy / diet) map onto the token
 * palette's first three series roles. Colours are read from the wired `--viz-*`
 * CSS custom properties at render time so the dark-theme shifts apply
 * automatically; the SVG pattern id is stable per series.
 */

export interface SeriesStyle {
  vizVar: string;
  patternId: string;
  patternKind: "solid" | "diagonal" | "dotted";
  marker: "circle" | "triangle" | "square";
  dash: string;
  patternLabel: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  transport: "Transport",
  energy: "Home energy",
  diet: "Food & diet",
};

export const CATEGORY_SERIES: Record<Category, SeriesStyle> = {
  energy: {
    vizVar: "var(--viz-1)",
    patternId: "viz-pat-energy",
    patternKind: "solid",
    marker: "circle",
    dash: "",
    patternLabel: "solid fill, circle marker",
  },
  transport: {
    vizVar: "var(--viz-2)",
    patternId: "viz-pat-transport",
    patternKind: "diagonal",
    marker: "triangle",
    dash: "6 3",
    patternLabel: "diagonal-hatch fill, triangle marker",
  },
  diet: {
    vizVar: "var(--viz-3)",
    patternId: "viz-pat-diet",
    patternKind: "dotted",
    marker: "square",
    dash: "8 3 2 3",
    patternLabel: "dotted fill, square marker",
  },
};

export const ALL_CATEGORIES: readonly Category[] = [
  "transport",
  "energy",
  "diet",
];

/**
 * One reusable <defs> of SVG patterns for every series, rendered once per chart.
 * The pattern uses the series' viz colour so a sighted user still gets the colour
 * cue, but the GEOMETRY (hatch / dots / solid) is what carries meaning without it.
 *
 * The geometry is crisp (a soft tint floor + a stronger mark) so
 * the pattern reads at the bar height: solid vs diagonal-hatch vs dotted
 * distinguishes the series in pure grayscale.
 */
export function SeriesPatternDefs() {
  return (
    <defs>
      {ALL_CATEGORIES.map((category) => {
        const s = CATEGORY_SERIES[category];
        return (
          <pattern
            key={s.patternId}
            id={s.patternId}
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
          >
            <rect width={6} height={6} fill={s.vizVar} opacity={0.16} />
            {s.patternKind === "solid" && (
              <rect width={6} height={6} fill={s.vizVar} />
            )}
            {s.patternKind === "diagonal" && (
              <path
                d="M0,6 L6,0 M-1,1 L1,-1 M5,7 L7,5"
                stroke={s.vizVar}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            )}
            {s.patternKind === "dotted" && (
              <circle cx={3} cy={3} r={1.4} fill={s.vizVar} />
            )}
          </pattern>
        );
      })}
    </defs>
  );
}

/**
 * A soft vertical gradient under the trend line: the series colour at the top of
 * the area fading to transparent at the baseline (a soft-premium area fill).
 * Purely decorative — the line, markers, value
 * labels and the data table carry all meaning, so this is colour-only by design
 * and lives inside the `aria-hidden` SVG.
 */
export function TrendAreaGradientDef({
  id,
  color = "var(--brand)",
}: {
  id: string;
  color?: string;
}) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity={0.22} />
        <stop offset="55%" stopColor={color} stopOpacity={0.08} />
        <stop offset="100%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

/**
 * A small inline SVG marker glyph for legends / table cells (non-colour cue).
 *
 * The shape is the load-bearing signal (circle / triangle / square — the same
 * marker the chart plots), with a hairline contrast ring so it stays crisp on the
 * pale surfaces. The shape, not the fill, distinguishes the series.
 */
export function SeriesMarker({
  category,
  size = 12,
}: {
  category: Category;
  size?: number;
}) {
  const s = CATEGORY_SERIES[category];
  const c = size / 2;
  const r = size * 0.38;
  const ring = { stroke: "var(--surface)", strokeWidth: size * 0.085 };
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
      className="inline-block shrink-0 align-middle"
    >
      {s.marker === "circle" && (
        <circle cx={c} cy={c} r={r} fill={s.vizVar} {...ring} />
      )}
      {s.marker === "triangle" && (
        <polygon
          points={`${c},${c - r} ${c + r},${c + r} ${c - r},${c + r}`}
          fill={s.vizVar}
          strokeLinejoin="round"
          {...ring}
        />
      )}
      {s.marker === "square" && (
        <rect
          x={c - r}
          y={c - r}
          width={r * 2}
          height={r * 2}
          rx={size * 0.08}
          fill={s.vizVar}
          {...ring}
        />
      )}
    </svg>
  );
}
