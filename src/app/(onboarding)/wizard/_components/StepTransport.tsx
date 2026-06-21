"use client";

import { NumberField } from "./NumberField";
import type { UnsureMap, WizardAnswers } from "./types";
import type { UnitSystem } from "@core/schemas";

/**
 * Wizard step 2 — Transport. Car and flight distance; units
 * follow the unit system (miles/passenger-miles imperial, km/passenger-km
 * metric). Switching the unit system converts these values in place upstream.
 */
export function StepTransport({
  unitSystem,
  answers,
  unsure,
  onAnswer,
  onUnsure,
}: {
  unitSystem: UnitSystem;
  answers: WizardAnswers;
  unsure: UnsureMap;
  onAnswer: (key: keyof WizardAnswers, value: string) => void;
  onUnsure: (key: string, value: boolean) => void;
}) {
  const metric = unitSystem === "metric";
  return (
    <fieldset className="space-y-7">
      <legend className="font-display text-h2 text-balance text-text">
        Transport
      </legend>
      <p className="max-w-[58ch] text-body text-text-secondary">
        How far you drive and fly. Distances over a typical month.
      </p>

      {/*
        Car: the EPA factor is per gallon of fuel (volume); the DEFRA factor is
        per km (distance). We ask the question that matches the chosen factor set
        so the entry always resolves — fuel under US/EPA, distance under
        metric/DEFRA — rather than producing a surprising "can't source" row.
      */}
      <NumberField
        id="car"
        label={
          metric ? "Car distance per month" : "Petrol/gasoline used per month"
        }
        unitLabel={metric ? "kilometres" : "gallons"}
        unitSuffix={metric ? "km" : "gallons"}
        hint={
          metric
            ? "Total distance in a petrol/diesel car. Leave blank if you don't drive."
            : "Total fuel you put in the tank. Leave blank if you don't drive."
        }
        value={answers.carDistance}
        onChange={(v) => onAnswer("carDistance", v)}
        unsure={!!unsure.carDistance}
        onUnsureChange={(v) => onUnsure("carDistance", v)}
      />

      <NumberField
        id="flight"
        label="Air travel per month"
        unitLabel={metric ? "passenger-kilometres" : "passenger-miles"}
        unitSuffix={metric ? "passenger-km" : "passenger-miles"}
        hint="Roughly how far you fly. One short hop is ~300 mi / ~500 km."
        value={answers.flightDistance}
        onChange={(v) => onAnswer("flightDistance", v)}
        unsure={!!unsure.flightDistance}
        onUnsureChange={(v) => onUnsure("flightDistance", v)}
      />
    </fieldset>
  );
}
