import type { ParsedUnknownCommand } from "../../commands/commandTypes";
import type { ResultBlock } from "../../domain/domainTypes";

export type ResultBlockType = ResultBlock["type"];

function createId(type: ResultBlockType): string {
  return `${type}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function createResultBlock(
  type: ResultBlockType,
  input: {
    commandText: string;
    collapsed?: boolean;
    payload?: unknown;
  },
): ResultBlock {
  return {
    id: createId(type),
    type,
    createdAt: new Date().toISOString(),
    commandText: input.commandText,
    collapsed: input.collapsed,
    payload: input.payload ?? {},
  };
}

export function createUnknownCommandResultBlock(
  command: ParsedUnknownCommand,
): ResultBlock {
  return createResultBlock("error", {
    commandText: command.raw,
    payload: {
      commandName: command.commandName,
      reason: command.reason,
    },
  });
}
