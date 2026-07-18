import { getNextRoundNumber, getNextTurnIndex } from "../combat/combatLogic";
import type {
  CombatSpacePayload,
  CombatTurnBlockPayload,
  ResultBlock,
  SceneContainerPayload,
} from "../domain/domainTypes";
import type {
  PluginCommandExecutionResult,
  PluginJsonValue,
  PluginResultBlock,
} from "../plugins/pluginApi";
import type { AppState } from "../state/appStore";
import { appStore } from "../state/appStore";
import type { ParsedCommand } from "./commandTypes";
import {
  createAskCommandResultBlock,
  createChaosCommandResultBlock,
  createInvalidCommandResultBlock,
  createPluginRandomTableCommandResultBlock,
  createResultBlock,
  createRollCommandResultBlock,
  createStatCommandResultBlock,
  createUnknownCommandResultBlock,
} from "./createCommandResultBlock";

export type CommandExecutionContext = {
  isInsideCombatSpace: boolean;
  chaosFactor: number;
};

export type CommandExecutionResult =
  | {
      type: "insertResultBlock";
      block: ResultBlock;
      display: "inline" | "block";
    }
  | {
      type: "insertSceneContainer";
      payload: SceneContainerPayload;
    }
  | {
      type: "insertCombatSpace";
      payload: CombatSpacePayload;
      initialTurn?: CombatTurnBlockPayload;
    }
  | {
      type: "insertCombatTurn";
      combatSpacePayload: Omit<CombatSpacePayload, "id">;
      turnPayload: CombatTurnBlockPayload;
      collapseCurrentTurn: boolean;
    }
  | {
      type: "endCombat";
    }
  | {
      type: "deleteCommand";
    };

function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createSceneContainerPayload(): SceneContainerPayload {
  return {
    id: createId("scene"),
    description: "",
    descriptionLocked: false,
  };
}

function createCombatSpacePayload(input: {
  roundNumber: number;
  currentTurnIndex: number;
  active: boolean;
  ended?: boolean;
}): CombatSpacePayload {
  return {
    id: createId("combat"),
    active: input.active,
    ended: input.ended === true,
    roundNumber: input.roundNumber,
    currentTurnIndex: input.currentTurnIndex,
  };
}

function createCombatTurnPayload(input: {
  combatantId: string;
  combatantName: string;
  roundNumber: number;
  turnIndex: number;
  current: boolean;
  collapsed?: boolean;
}): CombatTurnBlockPayload {
  return {
    id: createId("combat_turn"),
    combatantId: input.combatantId,
    combatantName: input.combatantName,
    roundNumber: input.roundNumber,
    turnIndex: input.turnIndex,
    current: input.current,
    collapsed: input.collapsed,
  };
}

function createCommandResultBlock(
  command: ParsedCommand,
  context: CommandExecutionContext,
): ResultBlock {
  switch (command.type) {
    case "ask":
      return createAskCommandResultBlock(command, context.chaosFactor);
    case "roll":
      return createRollCommandResultBlock(command);
    case "stat":
      return createStatCommandResultBlock(
        command,
        appStore.applyStatDelta({
          sheetName: command.sheetName,
          statName: command.statName,
          delta: command.delta,
        }),
      );
    case "trackerStat":
      return createStatCommandResultBlock(
        command,
        appStore.applyTrackerStatChange({
          characterName: command.characterName,
          statName: command.statName,
          mode: command.mode,
          value: command.value,
        }),
      );
    case "chaos":
      return createChaosCommandResultBlock(
        command,
        appStore.applyChaosDelta({ delta: command.delta }),
      );
    case "pluginRandomTable":
      return createPluginRandomTableCommandResultBlock(command);
    case "scriptPlugin":
      return createUnknownCommandResultBlock({
        type: "unknown",
        raw: command.raw,
        commandName: command.commandName,
        reason: "Script plugin command was not executed",
      });
    case "invalid":
      return createInvalidCommandResultBlock(command);
    case "unknown":
      return createUnknownCommandResultBlock(command);
    default:
      return createUnknownCommandResultBlock({
        type: "unknown",
        raw: "raw" in command ? command.raw : "",
        commandName: command.type,
        reason: "Command execution not implemented yet",
      });
  }
}

function resultBlockAction(
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

function errorResult(commandText: string, commandName: string, reason: string) {
  return resultBlockAction(
    createResultBlock("error", {
      commandText,
      payload: {
        commandName,
        reason,
      },
    }),
    "block",
  );
}

function isJsonSafe(value: unknown): value is PluginJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonSafe);
  }

  if (value && typeof value === "object") {
    return Object.values(value).every(isJsonSafe);
  }

  return false;
}

function isPluginResultBlock(value: unknown): value is PluginResultBlock {
  if (!value || typeof value !== "object") {
    return false;
  }

  const block = value as Record<string, unknown>;
  const validBlockTypes = [
    "roll",
    "oracle",
    "scene",
    "combat",
    "stat",
    "chaos",
    "error",
  ];

  return (
    typeof block.type === "string" &&
    validBlockTypes.includes(block.type) &&
    (block.commandText === undefined || typeof block.commandText === "string") &&
    (block.collapsed === undefined || typeof block.collapsed === "boolean") &&
    (block.payload === undefined || isJsonSafe(block.payload))
  );
}

function isPluginCommandExecutionResult(
  value: unknown,
): value is PluginCommandExecutionResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  const result = value as Record<string, unknown>;

  if (result.type === "deleteCommand") {
    return true;
  }

  return (
    result.type === "insertResultBlock" &&
    isPluginResultBlock(result.block) &&
    (result.display === undefined ||
      result.display === "inline" ||
      result.display === "block")
  );
}

function pluginResultBlockAction(
  result: PluginCommandExecutionResult,
  commandText: string,
): CommandExecutionResult {
  if (result.type === "deleteCommand") {
    return result;
  }

  const block = result.block;
  const resultBlock: ResultBlock = {
    id: createId(block.type),
    type: block.type,
    createdAt: new Date().toISOString(),
    commandText: block.commandText ?? commandText,
    collapsed: block.collapsed,
    payload: block.payload ?? {},
  };

  return resultBlockAction(resultBlock, result.display);
}

async function executeScriptPluginCommand(
  command: Extract<ParsedCommand, { type: "scriptPlugin" }>,
  context: CommandExecutionContext,
): Promise<CommandExecutionResult> {
  try {
    const result = await command.execute({
      pluginId: command.pluginId,
      args: command.args,
      argsText: command.argsText,
      chaosFactor: context.chaosFactor,
      selectedText: null,
    });

    if (!isPluginCommandExecutionResult(result)) {
      return errorResult(
        command.raw,
        command.commandName,
        "Script plugin returned an invalid command result",
      );
    }

    return pluginResultBlockAction(result, command.raw);
  } catch (error) {
    return errorResult(
      command.raw,
      command.commandName,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function executeCombatCommand(
  command: Extract<ParsedCommand, { type: "combat" }>,
  snapshot: AppState,
  context: CommandExecutionContext,
): CommandExecutionResult {
  if (!snapshot.activeSession) {
    return errorResult(command.raw, "combat", "No active session");
  }

  if (command.action === "begin") {
    appStore.requestRightPanelOpen();
    void appStore.startCombat();

    const combatState = snapshot.combatState;
    const combatants = combatState?.combatants ?? [];
    const currentTurnIndex = combatState?.currentTurnIndex ?? 0;
    const roundNumber = combatState?.roundNumber ?? 1;
    const firstCombatant = combatants[currentTurnIndex];

    return {
      type: "insertCombatSpace",
      payload: createCombatSpacePayload({
        active: true,
        currentTurnIndex,
        roundNumber,
      }),
      initialTurn:
        combatants.length >= 2 && firstCombatant
          ? createCombatTurnPayload({
              combatantId: firstCombatant.id,
              combatantName: firstCombatant.name,
              roundNumber,
              turnIndex: currentTurnIndex,
              current: true,
            })
          : undefined,
    };
  }

  if (!context.isInsideCombatSpace) {
    return errorResult(
      command.raw,
      "combat",
      "Use this combat command inside a combat space",
    );
  }

  if (command.action === "end") {
    void appStore.saveCombatState({ active: false });
    appStore.requestRightPanelClose();
    return { type: "endCombat" };
  }

  const combatState = snapshot.combatState;
  const combatants = combatState?.combatants ?? [];

  if (combatants.length < 2 || !combatState) {
    return { type: "deleteCommand" };
  }

  const currentTurnIndex =
    command.action === "turn"
      ? getNextTurnIndex(combatState.currentTurnIndex, combatants.length)
      : combatState.currentTurnIndex;
  const roundNumber =
    command.action === "turn"
      ? getNextRoundNumber(
          combatState.currentTurnIndex,
          combatants.length,
          combatState.roundNumber,
        )
      : combatState.roundNumber;
  const activeCombatant = combatants[currentTurnIndex];

  if (!activeCombatant) {
    return { type: "deleteCommand" };
  }

  if (command.action === "turn") {
    void appStore.saveCombatState({
      currentTurnIndex,
      roundNumber,
    });
  }

  return {
    type: "insertCombatTurn",
    combatSpacePayload: {
      active: true,
      ended: false,
      currentTurnIndex,
      roundNumber,
    },
    turnPayload: createCombatTurnPayload({
      combatantId: activeCombatant.id,
      combatantName: activeCombatant.name,
      roundNumber,
      turnIndex: currentTurnIndex,
      current: true,
    }),
    collapseCurrentTurn: command.action === "turn",
  };
}

export async function executeCommand(
  command: ParsedCommand,
  context: CommandExecutionContext,
): Promise<CommandExecutionResult> {
  const snapshot = appStore.getSnapshot();

  if (command.type === "scene") {
    if (context.isInsideCombatSpace) {
      return errorResult(command.raw, "scene", "/scene cannot be used inside combat");
    }

    if (!snapshot.activeSession) {
      return errorResult(command.raw, "scene", "No active session");
    }

    return {
      type: "insertSceneContainer",
      payload: createSceneContainerPayload(),
    };
  }

  if (command.type === "combat") {
    return executeCombatCommand(command, snapshot, context);
  }

  if (command.type === "scriptPlugin") {
    return executeScriptPluginCommand(command, context);
  }

  return resultBlockAction(createCommandResultBlock(command, context));
}
