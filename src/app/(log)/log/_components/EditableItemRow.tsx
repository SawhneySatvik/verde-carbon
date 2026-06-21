"use client";

import type { PreviewBreakdownRow, PreviewRow } from "@core/calculator/preview";
import type { Unit } from "@core/schemas";
import { UNIT_VOCABULARY } from "@core/schemas";
import { Badge } from "../../../_components/Badge";
import { Card } from "../../../_components/Card";
import { ShowTheMath } from "../../../_components/ShowTheMath";
import { AlertTriangle, CheckCircle } from "../../../_components/icons";
import { FactorPicker } from "./FactorPicker";
import { findChoice } from "./factorCatalog";
import { inputClass, type EditableItem } from "./ParseConfirmation";

/**
 * Presentational per-item `<li>` body: editable activity/quantity/unit fields,
 * the resolved/unresolved badge + CO₂e, "Show the math", and the inline picker.
 */
export function EditableItemRow({
  item,
  row,
  itemId,
  onEditActivity,
  onEditQuantity,
  onEditUnit,
  onResolve,
}: {
  item: EditableItem;
  row: PreviewRow;
  itemId: string;
  onEditActivity: (value: string) => void;
  onEditQuantity: (value: string) => void;
  onEditUnit: (value: Unit) => void;
  onResolve: (key: string) => void;
}) {
  const resolved = row.status === "resolved";
  return (
    <Card elevation="rest" accent={resolved ? "none" : "warning"} pad="md">
      <div className="flex items-center justify-between gap-3">
        <Badge
          tone={resolved ? "brand" : "warning"}
          icon={
            resolved ? <CheckCircle size={13} /> : <AlertTriangle size={13} />
          }
        >
          {resolved ? "Sourced" : "Needs a source"}
        </Badge>
        {resolved ? (
          <p className="numeric text-h3 leading-none text-brand-active">
            {(row as PreviewBreakdownRow).co2eKgDisplay.toFixed(2)}
            <span className="ml-1 text-body-sm font-normal text-text-secondary">
              kg CO₂e
            </span>
          </p>
        ) : (
          <p className="text-body-sm text-text-muted">Not yet counted</p>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${itemId}-activity`}
            className="text-caption font-medium text-text-secondary"
          >
            Activity
          </label>
          <input
            id={`${itemId}-activity`}
            type="text"
            value={item.activity}
            onChange={(e) => onEditActivity(e.target.value)}
            className={inputClass()}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${itemId}-qty`}
            className="text-caption font-medium text-text-secondary"
          >
            Quantity
          </label>
          <input
            id={`${itemId}-qty`}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={item.value}
            onChange={(e) => onEditQuantity(e.target.value)}
            className={inputClass("numeric")}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${itemId}-unit`}
            className="text-caption font-medium text-text-secondary"
          >
            Unit
          </label>
          <select
            id={`${itemId}-unit`}
            value={item.unit}
            onChange={(e) => onEditUnit(e.target.value as Unit)}
            className={inputClass()}
          >
            {UNIT_VOCABULARY.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Factor + source / picker. */}
      {resolved ? (
        <div className="mt-4 border-t border-border pt-4">
          <p className="text-body-sm text-text-secondary">
            Factor:{" "}
            <span className="font-medium text-text">
              {findChoice(item.candidateFactorKey)?.label ??
                item.candidateFactorKey}
            </span>
          </p>
          <div className="mt-2">
            <ShowTheMath row={row as PreviewBreakdownRow} />
          </div>
        </div>
      ) : (
        <FactorPicker
          idBase={itemId}
          selectedKey={item.candidateFactorKey}
          onPick={onResolve}
        />
      )}
    </Card>
  );
}
