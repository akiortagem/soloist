import type {
  ParsedInvalidCommand,
  ParsedRollCommand,
  ParsedUnknownCommand,
} from "../../commands/commandTypes";
import type { ResultBlock } from "../../domain/domainTypes";
import { rollDice } from "../../dice/rollDice";

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

export function createInvalidCommandResultBlock(
  command: ParsedInvalidCommand,
): ResultBlock {
  return createResultBlock("error", {
    commandText: command.raw,
    payload: {
      commandName: command.commandName,
      reason: command.reason,
    },
  });
}

export function createRollCommandResultBlock(command: ParsedRollCommand): ResultBlock {
  const rolled = rollDice(command.formula);

  if (!rolled.ok) {
    return createResultBlock("error", {
      commandText: command.raw,
      payload: {
        commandName: "roll",
        formula: command.formula,
        reason: rolled.error.message,
        code: rolled.error.code,
      },
    });
  }

  return createResultBlock("roll", {
    commandText: command.raw,
    payload: {
      formula: command.formula,
      normalizedFormula: rolled.value.formula,
      total: rolled.value.total,
      terms: rolled.value.terms,
    },
  });
}
