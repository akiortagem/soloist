import type {
  CharacterField,
  CurrentMaxNumberValue,
} from "../../../domain/domainTypes";

export function coerceNumberValue(value: string) {
  if (value.trim() === "") {
    return 0;
  }

  const numericValue = Number.parseFloat(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function coerceNonNegativeNumberValue(value: string) {
  return Math.max(0, coerceNumberValue(value));
}

export function getCurrentMaxValue(
  value: CharacterField["value"],
): CurrentMaxNumberValue {
  if (value && typeof value === "object") {
    const candidate = value as Partial<CurrentMaxNumberValue>;

    return {
      current:
        typeof candidate.current === "number" &&
        Number.isFinite(candidate.current)
          ? Math.max(0, candidate.current)
          : 0,
      max:
        typeof candidate.max === "number" && Number.isFinite(candidate.max)
          ? Math.max(0, candidate.max)
          : 0,
    };
  }

  return {
    current: 0,
    max: 0,
  };
}

export function formatFieldValue(field: CharacterField) {
  if (field.type === "boolean") {
    return field.value === true ? "true" : "false";
  }

  if (field.type === "current_max_number") {
    const value = getCurrentMaxValue(field.value);
    return `${value.current} / ${value.max}`;
  }

  return String(field.value);
}

export function coerceFieldValue(
  field: CharacterField,
  value: string | boolean,
) {
  if (field.type === "number") {
    return coerceNumberValue(String(value));
  }

  if (field.type === "boolean") {
    return value === true;
  }

  return String(value);
}
