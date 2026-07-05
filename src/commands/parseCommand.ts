import type { ParsedCommand } from "./commandTypes";
import {
  type SlashCommandRegistry,
  slashCommandRegistry,
} from "./slashCommandRegistry";
import {
  extractCommandName,
  startsWithSlash,
  trimCommandInput,
} from "./parserUtils";

export function parseCommand(
  raw: string,
  registry: SlashCommandRegistry = slashCommandRegistry,
): ParsedCommand {
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

  if (!commandName) {
    return {
      type: "unknown",
      raw,
      commandName,
      reason: "Command name is missing",
    };
  }

  const command = registry.getByName(commandName);

  if (!command?.parse) {
    return {
      type: "unknown",
      raw,
      commandName,
      reason: "Command parser not implemented yet",
    };
  }

  return command.parse({ raw, commandName, argsText });
}
