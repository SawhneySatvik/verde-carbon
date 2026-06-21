import { z } from "zod";

export const MAX_QUANTITY = 1_000_000;

export const UNIT_VOCABULARY = [
  "mile",
  "km",
  "gallon",
  "litre",
  "kWh",
  "MWh",
  "kg",
  "lb",
  "passenger-mile",
  "passenger-km",
  "meal",
  "night",
  "therm",
] as const;

export type Unit = (typeof UNIT_VOCABULARY)[number];

export const unitSchema = z.enum(UNIT_VOCABULARY);

export const unitSystemSchema = z.enum(["metric", "imperial"]);
export type UnitSystem = z.infer<typeof unitSystemSchema>;

export const factorSetSchema = z.enum(["EPA", "DEFRA_DESNZ"]);
export type FactorSet = z.infer<typeof factorSetSchema>;

export const localeSchema = z.enum(["UK", "US"]);
export type Locale = z.infer<typeof localeSchema>;

export const categorySchema = z.enum(["transport", "energy", "diet"]);
export type Category = z.infer<typeof categorySchema>;

export const activityOriginSchema = z.enum(["nl", "fallback", "baseline"]);
export type ActivityOrigin = z.infer<typeof activityOriginSchema>;

export const factorSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  edition: z.string().min(1),
  publishedYear: z.number().int().min(1990).max(2100),
});
export type FactorSource = z.infer<typeof factorSourceSchema>;

export const assertionStyleSchema = z.union([
  z.literal("toBe"),
  z.string().regex(/^toBeCloseTo:-?\d+(\.\d+)?:\d+$/),
]);
export type AssertionStyle = z.infer<typeof assertionStyleSchema>;

export const sourceNativeSchema = z.object({
  value: z.number().finite().positive(),
  unit: z.string().min(1),
});
export type SourceNative = z.infer<typeof sourceNativeSchema>;

export const factorRecordSchema = z.object({
  key: z.string().min(1),
  factorSet: factorSetSchema,
  category: categorySchema,
  value: z.number().finite().positive(),
  canonicalUnit: unitSchema,
  unitSystem: unitSystemSchema,
  source: factorSourceSchema,
  sourceNative: sourceNativeSchema.optional(),
  derivation: z.string().min(1).optional(),
  assertionStyle: assertionStyleSchema,
  factorSetVersion: z.string().min(1),
});
export type FactorRecord = z.infer<typeof factorRecordSchema>;

export const factorSetCollectionSchema = z.object({
  factorSet: factorSetSchema,
  factorSetVersion: z.string().min(1),
  records: z.array(factorRecordSchema).min(1),
});
export type FactorSetCollection = z.infer<typeof factorSetCollectionSchema>;

export const activitySchema = z.object({
  id: z.string().min(1),
  ts: z.number().int().nonnegative(),
  category: categorySchema,
  activity: z.string().min(1),
  quantity: z.number().finite().positive().max(MAX_QUANTITY),
  unit: unitSchema,
  factorKey: z.string().min(1),
  factorSet: factorSetSchema,
  factorSetVersion: z.string().min(1),
  co2eKg: z.number().finite().nonnegative(),
  source: factorSourceSchema,
  origin: activityOriginSchema,
});
export type Activity = z.infer<typeof activitySchema>;

export const goalSchema = z.object({
  id: z.string().min(1),
  type: z.literal("reduction"),
  targetPct: z.number().finite().positive().max(100),
  baselineKg: z.number().finite().nonnegative(),
  period: z.enum(["weekly", "monthly", "yearly"]),
  createdAt: z.number().int().nonnegative(),
  active: z.boolean(),
});
export type Goal = z.infer<typeof goalSchema>;

export const streakSchema = z.object({
  count: z.number().int().nonnegative(),
  lastLoggedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  longest: z.number().int().nonnegative(),
});
export type Streak = z.infer<typeof streakSchema>;

export const baselineLineItemSchema = z.object({
  category: categorySchema,
  activity: z.string().min(1),
  quantity: z.number().finite().positive().max(MAX_QUANTITY),
  unit: unitSchema,
  factorKey: z.string().min(1),
  co2eKg: z.number().finite().nonnegative(),
  source: factorSourceSchema,
});
export type BaselineLineItem = z.infer<typeof baselineLineItemSchema>;

export const baselineSchema = z.object({
  computedAt: z.number().int().nonnegative(),
  totalKg: z.number().finite().nonnegative(),
  factorSet: factorSetSchema,
  unitSystem: unitSystemSchema,
  lineItems: z.array(baselineLineItemSchema),
});
export type Baseline = z.infer<typeof baselineSchema>;
