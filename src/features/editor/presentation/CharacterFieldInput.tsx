import type {
  CharacterField,
  CurrentMaxNumberValue,
} from "../../../domain/domainTypes";
import {
  coerceNonNegativeNumberValue,
  formatFieldValue,
  getCurrentMaxValue,
} from "./characterFieldValues";

export function CharacterFieldInput({
  field,
  updateField,
  updateCurrentMaxField,
}: {
  field: CharacterField;
  updateField: (
    field: CharacterField,
    value: string | boolean,
  ) => Promise<unknown>;
  updateCurrentMaxField: (
    field: CharacterField,
    patch: Partial<CurrentMaxNumberValue>,
  ) => Promise<unknown>;
}) {
  const currentMaxValue =
    field.type === "current_max_number"
      ? getCurrentMaxValue(field.value)
      : null;

  return (
    <div className="sheet-field-row" key={field.id}>
      <label>
        {field.name}
        {field.type === "boolean" ? (
          <input
            checked={field.value === true}
            onChange={(event) =>
              void updateField(field, event.currentTarget.checked)
            }
            type="checkbox"
          />
        ) : field.type === "longText" ? (
          <textarea
            onChange={(event) =>
              void updateField(field, event.currentTarget.value)
            }
            rows={3}
            value={formatFieldValue(field)}
          />
        ) : field.type === "current_max_number" && currentMaxValue ? (
          <div className="sheet-current-max-field">
            <input
              aria-label={`${field.name} current value`}
              min={0}
              onChange={(event) =>
                void updateCurrentMaxField(field, {
                  current: coerceNonNegativeNumberValue(
                    event.currentTarget.value,
                  ),
                })
              }
              type="number"
              value={currentMaxValue.current}
            />
            <span>/</span>
            <input
              aria-label={`${field.name} maximum value`}
              min={0}
              onChange={(event) =>
                void updateCurrentMaxField(field, {
                  max: coerceNonNegativeNumberValue(event.currentTarget.value),
                })
              }
              type="number"
              value={currentMaxValue.max}
            />
          </div>
        ) : (
          <input
            max={field.maxValue}
            min={field.minValue}
            onChange={(event) =>
              void updateField(field, event.currentTarget.value)
            }
            type={field.type === "number" ? "number" : "text"}
            value={formatFieldValue(field)}
          />
        )}
      </label>
    </div>
  );
}
