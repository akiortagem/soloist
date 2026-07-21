import type { ResultBlock } from "../../../domain/domainTypes";
import type {
  PluginCommandExecutionResult,
  PluginJsonValue,
  PluginResultBlock,
} from "../../../plugins/pluginApi";
import { createResultBlock } from "./commandResultBlocks";
import type { CommandExecutionResult } from "../domain/CommandExecution";
import type { CommandValues } from "./ports/CommandEffects";

export function resultBlockAction(
  block: ResultBlock,
  display?: "inline" | "block",
): CommandExecutionResult {
  return {
    type: "insertResultBlock",
    block,
    display:
      display ??
      (block.type === "roll" || block.type === "stat" || block.type === "chaos"
        ? "inline"
        : "block"),
  };
}

export function errorResult(
  commandText: string,
  commandName: string,
  reason: string,
  values: CommandValues,
) {
  return resultBlockAction(
    createResultBlock(
      "error",
      {
        commandText,
        payload: { commandName, reason },
      },
      values,
    ),
    "block",
  );
}

function isJsonSafe(value: unknown): value is PluginJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return true;
  if (Array.isArray(value)) return value.every(isJsonSafe);
  return Boolean(
    value &&
    typeof value === "object" &&
    Object.values(value).every(isJsonSafe),
  );
}

function isPluginResultBlock(value: unknown): value is PluginResultBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Record<string, unknown>;
  return (
    typeof block.type === "string" &&
    ["roll", "oracle", "scene", "combat", "stat", "chaos", "error"].includes(
      block.type,
    ) &&
    (block.commandText === undefined ||
      typeof block.commandText === "string") &&
    (block.collapsed === undefined || typeof block.collapsed === "boolean") &&
    (block.payload === undefined || isJsonSafe(block.payload))
  );
}

export function isPluginCommandExecutionResult(
  value: unknown,
): value is PluginCommandExecutionResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (result.type === "deleteCommand") return true;
  return (
    result.type === "insertResultBlock" &&
    isPluginResultBlock(result.block) &&
    (result.display === undefined ||
      result.display === "inline" ||
      result.display === "block")
  );
}

export function pluginResultAction(
  result: PluginCommandExecutionResult,
  commandText: string,
  values: CommandValues,
): CommandExecutionResult {
  if (result.type === "deleteCommand") return result;
  return resultBlockAction(
    {
      id: values.id(result.block.type),
      type: result.block.type,
      createdAt: values.now(),
      commandText: result.block.commandText ?? commandText,
      collapsed: result.block.collapsed,
      payload: result.block.payload ?? {},
    },
    result.display,
  );
}
