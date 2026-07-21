import type {
  ParsedAskCommand,
  ParsedChaosCommand,
  ParsedInvalidCommand,
  ParsedPluginRandomTableCommand,
  ParsedRollCommand,
  ParsedStatCommand,
  ParsedTrackerStatCommand,
  ParsedUnknownCommand,
} from "../domain/commandTypes";
import { rollDice } from "../../../dice/rollDice";
import type { ResultBlock } from "../../../domain/domainTypes";
import type { ChaosDeltaResult, StatDeltaResult } from "./ports/CommandEffects";
import type { CommandValues } from "./ports/CommandEffects";

export type ResultBlockType = ResultBlock["type"];

export function createResultBlock(
  type: ResultBlockType,
  input: {
    commandText: string;
    collapsed?: boolean;
    payload?: unknown;
  },
  values: CommandValues,
): ResultBlock {
  return {
    id: values.id(type),
    type,
    createdAt: values.now(),
    commandText: input.commandText,
    collapsed: input.collapsed,
    payload: input.payload ?? {},
  };
}

export function createUnknownCommandResultBlock(
  command: ParsedUnknownCommand,
  values: CommandValues,
): ResultBlock {
  return createResultBlock(
    "error",
    {
      commandText: command.raw,
      payload: {
        commandName: command.commandName,
        reason: command.reason,
      },
    },
    values,
  );
}

export function createInvalidCommandResultBlock(
  command: ParsedInvalidCommand,
  values: CommandValues,
): ResultBlock {
  return createResultBlock(
    "error",
    {
      commandText: command.raw,
      payload: {
        commandName: command.commandName,
        reason: command.reason,
      },
    },
    values,
  );
}

export function createRollCommandResultBlock(
  command: ParsedRollCommand,
  values: CommandValues,
): ResultBlock {
  const rolled = rollDice(command.formula, values.random);

  if (!rolled.ok) {
    return createResultBlock(
      "error",
      {
        commandText: command.raw,
        payload: {
          commandName: "roll",
          formula: command.formula,
          reason: rolled.error.message,
          code: rolled.error.code,
        },
      },
      values,
    );
  }

  return createResultBlock(
    "roll",
    {
      commandText: command.raw,
      payload: {
        formula: command.formula,
        normalizedFormula: rolled.value.formula,
        total: rolled.value.total,
        terms: rolled.value.terms,
      },
    },
    values,
  );
}

export function createAskCommandResultBlock(
  command: ParsedAskCommand,
  chaosFactor: number,
  values: CommandValues,
): Promise<ResultBlock> {
  const oracle = values.activeOracle();
  const roll = Math.floor(values.random() * 100) + 1;
  return Promise.resolve(
    oracle.askYesNo({
      question: command.question,
      odds: command.odds,
      d100: roll,
      chaosFactor,
    }),
  ).then((result) =>
    createResultBlock(
      "oracle",
      {
        commandText: command.raw,
        collapsed: true,
        payload: result,
      },
      values,
    ),
  );
}

export function createStatCommandResultBlock(
  command: ParsedStatCommand | ParsedTrackerStatCommand,
  result: StatDeltaResult,
  values: CommandValues,
): ResultBlock {
  if (!result.ok) {
    return createResultBlock(
      "error",
      {
        commandText: command.raw,
        payload: {
          commandName: "stat",
          reason: result.reason,
        },
      },
      values,
    );
  }

  return createResultBlock(
    "stat",
    {
      commandText: command.raw,
      payload: {
        sheet: result.sheetName,
        stat: result.statName,
        delta: result.changeText ?? result.delta,
        beforeValue: result.beforeValue,
        afterValue: result.afterValue,
      },
    },
    values,
  );
}

export function createChaosCommandResultBlock(
  command: ParsedChaosCommand,
  result: ChaosDeltaResult,
  values: CommandValues,
): ResultBlock {
  if (!result.ok) {
    return createResultBlock(
      "error",
      {
        commandText: command.raw,
        payload: {
          commandName: "chaos",
          reason: result.reason,
        },
      },
      values,
    );
  }

  return createResultBlock(
    "chaos",
    {
      commandText: command.raw,
      payload: {
        delta: result.delta,
        beforeValue: result.beforeValue,
        afterValue: result.afterValue,
      },
    },
    values,
  );
}

export function createPluginRandomTableCommandResultBlock(
  command: ParsedPluginRandomTableCommand,
  values: CommandValues,
): ResultBlock {
  const table = values.oracleTable(command.tableId);

  if (!table) {
    return createResultBlock(
      "error",
      {
        commandText: command.raw,
        payload: {
          commandName: command.commandName,
          pluginId: command.pluginId,
          tableId: command.tableId,
          reason: `Random table not found: ${command.tableId}`,
        },
      },
      values,
    );
  }

  if (table.entries.length === 0) {
    return createResultBlock(
      "error",
      {
        commandText: command.raw,
        payload: {
          commandName: command.commandName,
          pluginId: command.pluginId,
          tableId: command.tableId,
          tableName: table.name,
          reason: `Random table has no entries: ${table.name}`,
        },
      },
      values,
    );
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
    table.entries[Math.floor(values.random() * table.entries.length)];

  return createResultBlock(
    "oracle",
    {
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
    },
    values,
  );
}
