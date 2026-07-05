import type {
  ParsedAskCommand,
  ParsedChaosCommand,
  ParsedInvalidCommand,
  ParsedPluginRandomTableCommand,
  ParsedRollCommand,
  ParsedStatCommand,
  ParsedTrackerStatCommand,
  ParsedUnknownCommand,
} from "./commandTypes";
import { rollDice } from "../dice/rollDice";
import type { ResultBlock } from "../domain/domainTypes";
import { getActiveOracleProvider, oracleTableRegistry } from "../oracle/oracleRegistry";
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

export function createPluginRandomTableCommandResultBlock(
  command: ParsedPluginRandomTableCommand,
): ResultBlock {
  const table = oracleTableRegistry.get(command.tableId);

  if (!table) {
    return createResultBlock("error", {
      commandText: command.raw,
      payload: {
        commandName: command.commandName,
        pluginId: command.pluginId,
        tableId: command.tableId,
        reason: `Random table not found: ${command.tableId}`,
      },
    });
  }

  if (table.entries.length === 0) {
    return createResultBlock("error", {
      commandText: command.raw,
      payload: {
        commandName: command.commandName,
        pluginId: command.pluginId,
        tableId: command.tableId,
        tableName: table.name,
        reason: `Random table has no entries: ${table.name}`,
      },
    });
  }

  const rolled = rollDice(table.dice);
  const matchingEntry = rolled.ok
    ? table.entries.find(
        (entry) =>
          rolled.value.total >= entry.min && rolled.value.total <= entry.max,
      )
    : undefined;
  const entry =
    matchingEntry ??
    table.entries[Math.floor(Math.random() * table.entries.length)];

  return createResultBlock("oracle", {
    commandText: command.raw,
    collapsed: true,
    payload: {
      pluginId: command.pluginId,
      tableId: table.contributionId,
      tableName: table.name,
      entry: {
        id: entry.id,
        text: entry.text,
        min: entry.min,
        max: entry.max,
      },
      roll: rolled.ok
        ? {
            formula: rolled.value.formula,
            total: rolled.value.total,
            terms: rolled.value.terms,
          }
        : undefined,
    },
  });
}
