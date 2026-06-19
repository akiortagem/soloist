import type { ParsedCommand } from "./commandTypes";
import { extractCommandName, startsWithSlash, trimCommandInput } from "./parserUtils";

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = trimCommandInput(raw);

  if (trimmed.length === 0) {
    return {
      type: "unknown",
      raw,
      reason: "Command input is empty",
    };
  }

  if (!startsWithSlash(trimmed)) {
    return {
      type: "unknown",
      raw,
      reason: "Command input must start with /",
    };
  }

  const { commandName, argsText } = extractCommandName(trimmed);

  if (commandName === "roll") {
    if (argsText.length === 0) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: "Missing dice formula",
      };
    }

    return {
      type: "roll",
      raw,
      formula: argsText,
    };
  }

  return {
    type: "unknown",
    raw,
    commandName,
    reason: commandName
      ? "Command parser not implemented yet"
      : "Command name is missing",
  };
}
