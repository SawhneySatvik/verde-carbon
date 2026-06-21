import type {
  FactorRecord,
  FactorSet,
  FactorSetCollection,
  Locale,
  UnitSystem,
} from "@core/schemas";
import { allFactorRecords } from "./seed/index";

export interface LocaleDefaults {
  factorSet: FactorSet;
  unitSystem: UnitSystem;
}

export const LOCALE_DEFAULTS: Record<Locale, LocaleDefaults> = {
  UK: { factorSet: "DEFRA_DESNZ", unitSystem: "metric" },
  US: { factorSet: "EPA", unitSystem: "imperial" },
};

export interface ResolutionPreference {
  locale?: Locale;
  factorSet?: FactorSet;
}

export class UnknownFactorKeyError extends Error {
  constructor(public readonly key: string) {
    super(`Unknown factor key "${key}": not in the seeded factor vocabulary.`);
    this.name = "UnknownFactorKeyError";
  }
}

function compositeId(key: string, factorSet: FactorSet): string {
  return `${factorSet}::${key}`;
}

export class FactorRepository {
  private readonly byComposite: ReadonlyMap<string, FactorRecord>;
  private readonly keys: ReadonlySet<string>;

  constructor(records: readonly FactorRecord[]) {
    const byComposite = new Map<string, FactorRecord>();
    const keys = new Set<string>();
    for (const record of records) {
      const id = compositeId(record.key, record.factorSet);
      if (byComposite.has(id)) {
        throw new Error(
          `Duplicate factor record for ${id} — seed vocabulary must be unique per factor set.`,
        );
      }
      byComposite.set(id, record);
      keys.add(record.key);
    }
    this.byComposite = byComposite;
    this.keys = keys;
  }

  static fromSeed(): FactorRepository {
    return new FactorRepository(allFactorRecords);
  }

  static fromCollections(
    collections: readonly FactorSetCollection[],
  ): FactorRepository {
    return new FactorRepository(collections.flatMap((c) => c.records));
  }

  defaultsForLocale(locale: Locale): LocaleDefaults {
    return LOCALE_DEFAULTS[locale];
  }

  resolveFactorSet(preference: ResolutionPreference): FactorSet {
    if (preference.factorSet) {
      return preference.factorSet;
    }
    if (preference.locale) {
      return LOCALE_DEFAULTS[preference.locale].factorSet;
    }
    return LOCALE_DEFAULTS.US.factorSet;
  }

  isKnownKey(key: unknown): key is string {
    return typeof key === "string" && key.length > 0 && this.keys.has(key);
  }

  assertKnownKey(key: unknown): asserts key is string {
    if (!this.isKnownKey(key)) {
      throw new UnknownFactorKeyError(
        typeof key === "string" ? key : String(key),
      );
    }
  }

  find(key: string, factorSet: FactorSet): FactorRecord | undefined {
    return this.byComposite.get(compositeId(key, factorSet));
  }

  resolve(key: unknown, preference: ResolutionPreference): FactorRecord {
    this.assertKnownKey(key);
    const factorSet = this.resolveFactorSet(preference);
    const record = this.find(key, factorSet);
    if (record) {
      return record;
    }
    const fallback = [...this.byComposite.values()].find((r) => r.key === key);
    if (fallback) {
      return fallback;
    }
    throw new UnknownFactorKeyError(key);
  }

  knownKeys(): readonly string[] {
    return [...this.keys];
  }

  records(): readonly FactorRecord[] {
    return [...this.byComposite.values()];
  }
}
