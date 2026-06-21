import {
  factorSetCollectionSchema,
  type FactorRecord,
  type FactorSetCollection,
} from "@core/schemas";
import epaRaw from "./epa.json";
import defraRaw from "./defra-desnz.json";

export const epaFactorSet: FactorSetCollection =
  factorSetCollectionSchema.parse(epaRaw);

export const defraDesnzFactorSet: FactorSetCollection =
  factorSetCollectionSchema.parse(defraRaw);

export const factorCollections: readonly FactorSetCollection[] = [
  epaFactorSet,
  defraDesnzFactorSet,
];

export const allFactorRecords: readonly FactorRecord[] =
  factorCollections.flatMap((collection) => collection.records);
