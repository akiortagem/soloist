import type {
  ParsedAskCommand,
  ParsedChaosCommand,
  ParsedInvalidCommand,
  ParsedRollCommand,
  ParsedStatCommand,
  ParsedTrackerStatCommand,
  ParsedUnknownCommand,
} from "./commandTypes";
import { rollDice } from "../dice/rollDice";
import type { ResultBlock } from "../domain/domainTypes";
import { getActiveOracleProvider } from "../oracle/oracleRegistry";
import type { ChaosDeltaResult, StatDeltaResult } from "../state/appStore";

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

export function createAskCommandResultBlock(
  command: ParsedAskCommand,
  chaosFactor: number,
): ResultBlock {
  const oracle = getActiveOracleProvider();
  const roll = Math.floor(Math.random() * 100) + 1;
  const result = oracle.askYesNo({
    question: command.question,
    odds: command.odds,
    d100: roll,
    chaosFactor,
  });

  return createResultBlock("oracle", {
    commandText: command.raw,
    collapsed: true,
    payload: result,
  });
}

export function createStatCommandResultBlock(
  command: ParsedStatCommand | ParsedTrackerStatCommand,
  result: StatDeltaResult,
): ResultBlock {
  if (!result.ok) {
    return createResultBlock("error", {
      commandText: command.raw,
      payload: {
        commandName: "stat",
        reason: result.reason,
      },
    });
  }

  return createResultBlock("stat", {
    commandText: command.raw,
    payload: {
      sheet: result.sheetName,
      stat: result.statName,
      delta: result.changeText ?? result.delta,
      beforeValue: result.beforeValue,
      afterValue: result.afterValue,
    },
  });
}

export function createChaosCommandResultBlock(
  command: ParsedChaosCommand,
  result: ChaosDeltaResult,
): ResultBlock {
  if (!result.ok) {
    return createResultBlock("error", {
      commandText: command.raw,
      payload: {
        commandName: "chaos",
        reason: result.reason,
      },
    });
  }

  return createResultBlock("chaos", {
    commandText: command.raw,
    payload: {
      delta: result.delta,
      beforeValue: result.beforeValue,
      afterValue: result.afterValue,
    },
  });
}
