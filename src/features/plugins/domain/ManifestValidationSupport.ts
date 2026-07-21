import type { CharacterFieldValue } from "../../../domain/domainTypes";
import type {
  PluginManifestValidationErrorCode,
  ValidationContext,
} from "./PluginManifest";

export type ItemValidator = (
  item: unknown,
  path: string,
  context: ValidationContext,
) => void;

export function optionalArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
  validator: ItemValidator,
): void {
  if (hasOwn(value, key))
    array(value[key], `${path}.${key}`, context, validator);
}

export function requiredArray(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
  validator: ItemValidator,
): void {
  if (!hasOwn(value, key)) {
    missing(context, path, key);
    return;
  }
  array(value[key], `${path}.${key}`, context, validator);
}

function array(
  value: unknown,
  path: string,
  context: ValidationContext,
  validator: ItemValidator,
): void {
  if (!Array.isArray(value)) {
    error(context, path, "INVALID_ARRAY", `${path} must be an array`);
    return;
  }
  value.forEach((item, index) => validator(item, `${path}[${index}]`, context));
}

export function requiredString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    missing(context, path, key);
    return;
  }
  if (typeof value[key] !== "string") {
    error(context, `${path}.${key}`, "INVALID_TYPE", `${key} must be a string`);
  } else if (value[key].trim().length === 0) {
    error(context, `${path}.${key}`, "EMPTY_STRING", `${key} cannot be empty`);
  }
}

export function optionalString(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (hasOwn(value, key) && typeof value[key] !== "string")
    error(context, `${path}.${key}`, "INVALID_TYPE", `${key} must be a string`);
}

export function requiredNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    missing(context, path, key);
    return;
  }
  finiteNumber(value, key, path, context);
}

export function optionalNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (hasOwn(value, key)) finiteNumber(value, key, path, context);
}

function finiteNumber(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (typeof value[key] !== "number" || !Number.isFinite(value[key]))
    error(
      context,
      `${path}.${key}`,
      "INVALID_NUMBER",
      `${key} must be a finite number`,
    );
}

export function requiredLiteral<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    missing(context, path, key);
    return;
  }
  optionalLiteral(value, key, allowed, path, context);
}

export function optionalLiteral<T extends string>(
  value: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  path: string,
  context: ValidationContext,
): void {
  if (hasOwn(value, key) && !allowed.includes(value[key] as T))
    error(
      context,
      `${path}.${key}`,
      "INVALID_TYPE",
      `${key} must be one of: ${allowed.join(", ")}`,
    );
}

export function requiredCharacterValue(
  value: Record<string, unknown>,
  key: string,
  path: string,
  context: ValidationContext,
): void {
  if (!hasOwn(value, key)) {
    missing(context, path, key);
    return;
  }
  if (!isCharacterValue(value[key]))
    error(
      context,
      `${path}.${key}`,
      "INVALID_FIELD_VALUE",
      "defaultValue must be a string, number, boolean, or current/max number object",
    );
}

function isCharacterValue(value: unknown): value is CharacterFieldValue {
  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return true;
  return (
    record(value) &&
    typeof value.current === "number" &&
    Number.isFinite(value.current) &&
    typeof value.max === "number" &&
    Number.isFinite(value.max) &&
    Object.keys(value).every((key) => key === "current" || key === "max")
  );
}

export function rejectKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  context: ValidationContext,
  code: Extract<
    PluginManifestValidationErrorCode,
    "UNKNOWN_FIELD" | "UNKNOWN_CONTRIBUTION_TYPE"
  >,
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key))
      error(
        context,
        `${path}.${key}`,
        code,
        code === "UNKNOWN_CONTRIBUTION_TYPE"
          ? `Unknown contribution type: ${key}`
          : `Unknown field: ${key}`,
      );
  }
}

export function missing(
  context: ValidationContext,
  path: string,
  key: string,
): void {
  error(
    context,
    `${path}.${key}`,
    "MISSING_FIELD",
    `Missing required field: ${key}`,
  );
}

export function error(
  context: ValidationContext,
  path: string,
  code: PluginManifestValidationErrorCode,
  message: string,
): void {
  context.errors.push({ path, code, message });
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
