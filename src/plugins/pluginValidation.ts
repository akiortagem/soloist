import type {
  PluginCommandExecutionResult,
  PluginJsonValue,
  PluginResultBlock,
} from "./pluginApi";

export const PLUGIN_STRING_LIMITS = {
  identifier: 128,
  name: 128,
  label: 256,
  description: 2_048,
  commandText: 2_048,
} as const;

export const PLUGIN_JSON_LIMITS = {
  maxDepth: 16,
  maxNodes: 10_000,
  maxStringLength: 262_144,
} as const;

export type ValidatedSlashCommandRegistration = {
  id: string;
  name: string;
  label: string;
  prefix: string;
  description?: string;
};

export function validateSlashCommandRegistration(
  value: unknown,
): ValidatedSlashCommandRegistration {
  const command = requireRecord(value, "Slash command registration");
  rejectUnknownKeys(command, ["id", "name", "label", "prefix", "description"]);
  const id = requireBoundedString(command.id, "Slash command id", PLUGIN_STRING_LIMITS.identifier);
  const name = requireBoundedString(command.name, "Slash command name", PLUGIN_STRING_LIMITS.name);
  const label = requireBoundedString(command.label, "Slash command label", PLUGIN_STRING_LIMITS.label);
  const prefix = requireBoundedString(command.prefix, "Slash command prefix", PLUGIN_STRING_LIMITS.commandText);
  if (!/^\/[A-Za-z0-9][A-Za-z0-9_-]*(?: )?$/.test(prefix)) {
    throw new Error('Slash command prefix must look like "/command" or "/command "');
  }
  if (prefix.slice(1).trim().toLowerCase() !== name.toLowerCase()) {
    throw new Error("Slash command prefix must match its command name");
  }
  const description = command.description === undefined
    ? undefined
    : requireBoundedString(command.description, "Slash command description", PLUGIN_STRING_LIMITS.description, true);
  return { id, name, label, prefix, description };
}

export function validatePluginCommandExecutionResult(
  value: unknown,
): PluginCommandExecutionResult {
  const result = requireRecord(value, "Plugin command result");
  if (result.type === "deleteCommand") {
    rejectUnknownKeys(result, ["type"]);
    return { type: "deleteCommand" };
  }
  if (result.type !== "insertResultBlock") {
    throw new Error(`Unknown plugin command result type: ${String(result.type)}`);
  }
  rejectUnknownKeys(result, ["type", "block", "display"]);
  if (result.display !== undefined && result.display !== "inline" && result.display !== "block") {
    throw new Error('Plugin command result display must be "inline" or "block"');
  }
  const block = validatePluginResultBlock(result.block);
  return {
    type: "insertResultBlock",
    block,
    ...(result.display === undefined ? {} : { display: result.display }),
  };
}

export function validatePluginResultBlock(value: unknown): PluginResultBlock {
  const block = requireRecord(value, "Plugin result block");
  rejectUnknownKeys(block, ["type", "commandText", "collapsed", "payload"]);
  const types = ["roll", "oracle", "scene", "combat", "stat", "chaos", "error"] as const;
  if (!types.includes(block.type as (typeof types)[number])) {
    throw new Error(`Unknown plugin result block type: ${String(block.type)}`);
  }
  if (block.commandText !== undefined) {
    requireBoundedString(block.commandText, "Result block commandText", PLUGIN_STRING_LIMITS.commandText, true);
  }
  if (block.collapsed !== undefined && typeof block.collapsed !== "boolean") {
    throw new Error("Result block collapsed must be a boolean");
  }
  if (block.payload !== undefined) assertJsonSafe(block.payload, "Result block payload");
  return block as PluginResultBlock;
}

export function assertJsonSafe(value: unknown, label = "Plugin payload"): asserts value is PluginJsonValue {
  let nodes = 0;
  const ancestors = new Set<object>();
  const visit = (current: unknown, depth: number): void => {
    nodes += 1;
    if (nodes > PLUGIN_JSON_LIMITS.maxNodes) throw new Error(`${label} exceeds the JSON value limit`);
    if (depth > PLUGIN_JSON_LIMITS.maxDepth) throw new Error(`${label} exceeds the nesting limit`);
    if (current === null || typeof current === "boolean") return;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) throw new Error(`${label} contains a non-finite number`);
      return;
    }
    if (typeof current === "string") {
      if (current.length > PLUGIN_JSON_LIMITS.maxStringLength) throw new Error(`${label} exceeds the string size limit`);
      return;
    }
    if (typeof current !== "object") throw new Error(`${label} must be JSON-safe`);
    if (ancestors.has(current)) throw new Error(`${label} must not contain cycles`);
    if (!Array.isArray(current) && Object.getPrototypeOf(current) !== Object.prototype && Object.getPrototypeOf(current) !== null) {
      throw new Error(`${label} must contain only plain JSON objects`);
    }
    ancestors.add(current);
    if (Array.isArray(current)) current.forEach((item) => visit(item, depth + 1));
    else Object.values(current).forEach((item) => visit(item, depth + 1));
    ancestors.delete(current);
  };
  visit(value, 0);
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`${label} must be a plain object`);
  }
  return value as Record<string, unknown>;
}

export function requireMessageString(value: unknown, label: string, max = 2_048): string {
  return requireBoundedString(value, label, max);
}

function requireBoundedString(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  if (!allowEmpty && value.trim().length === 0) throw new Error(`${label} cannot be empty`);
  if (value.length > max) throw new Error(`${label} cannot exceed ${max} characters`);
  return value;
}

function rejectUnknownKeys(value: Record<string, unknown>, allowed: readonly string[]): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) throw new Error(`Unknown field: ${unknown}`);
}
