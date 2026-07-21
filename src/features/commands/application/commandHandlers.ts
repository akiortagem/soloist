import {
  getNextRoundNumber,
  getNextTurnIndex,
} from "../../../combat/combatLogic";
import type { ParsedCommand } from "../domain/commandTypes";
import {
  createAskCommandResultBlock,
  createChaosCommandResultBlock,
  createInvalidCommandResultBlock,
  createPluginRandomTableCommandResultBlock,
  createRollCommandResultBlock,
  createStatCommandResultBlock,
  createUnknownCommandResultBlock,
} from "./commandResultBlocks";
import type { CombatTurnBlockPayload } from "../../../domain/domainTypes";
import type {
  CommandExecutionContext,
  CommandExecutionResult,
} from "../domain/CommandExecution";
import {
  errorResult,
  isPluginCommandExecutionResult,
  pluginResultAction,
  resultBlockAction,
} from "./commandResults";
import type { CommandEffects, CommandValues } from "./ports/CommandEffects";

type Dependencies = { effects: CommandEffects; values: CommandValues };

function combatTurn(
  values: CommandValues,
  input: Omit<CombatTurnBlockPayload, "id">,
): CombatTurnBlockPayload {
  return { id: values.id("combat_turn"), ...input };
}

export async function executeBasicCommand(
  command: Exclude<
    ParsedCommand,
    { type: "scene" | "combat" | "scriptPlugin" }
  >,
  context: CommandExecutionContext,
  dependencies: Dependencies,
): Promise<CommandExecutionResult> {
  const { effects, values } = dependencies;
  switch (command.type) {
    case "ask":
      return resultBlockAction(
        await createAskCommandResultBlock(command, context.chaosFactor, values),
      );
    case "roll":
      return resultBlockAction(createRollCommandResultBlock(command, values));
    case "stat":
      return resultBlockAction(
        createStatCommandResultBlock(
          command,
          effects.applyStatDelta(command),
          values,
        ),
      );
    case "trackerStat":
      return resultBlockAction(
        createStatCommandResultBlock(
          command,
          effects.applyTrackerStatChange(command),
          values,
        ),
      );
    case "chaos":
      return resultBlockAction(
        createChaosCommandResultBlock(
          command,
          effects.applyChaosDelta(command),
          values,
        ),
      );
    case "pluginRandomTable":
      return resultBlockAction(
        createPluginRandomTableCommandResultBlock(command, values),
      );
    case "invalid":
      return resultBlockAction(
        createInvalidCommandResultBlock(command, values),
      );
    case "unknown":
      return resultBlockAction(
        createUnknownCommandResultBlock(command, values),
      );
  }
}

export async function executePluginCommand(
  command: Extract<ParsedCommand, { type: "scriptPlugin" }>,
  context: CommandExecutionContext,
  dependencies: Dependencies,
): Promise<CommandExecutionResult> {
  try {
    const result = await command.execute({
      pluginId: command.pluginId,
      args: command.args,
      argsText: command.argsText,
      chaosFactor: context.chaosFactor,
      selectedText: null,
    });
    return isPluginCommandExecutionResult(result)
      ? pluginResultAction(result, command.raw, dependencies.values)
      : errorResult(
          command.raw,
          command.commandName,
          "Script plugin returned an invalid command result",
          dependencies.values,
        );
  } catch (error) {
    return errorResult(
      command.raw,
      command.commandName,
      error instanceof Error ? error.message : String(error),
      dependencies.values,
    );
  }
}

export function executeSceneCommand(
  command: Extract<ParsedCommand, { type: "scene" }>,
  context: CommandExecutionContext,
  dependencies: Dependencies,
): CommandExecutionResult {
  if (context.isInsideCombatSpace)
    return errorResult(
      command.raw,
      "scene",
      "/scene cannot be used inside combat",
      dependencies.values,
    );
  if (!dependencies.effects.snapshot().hasActiveSession)
    return errorResult(
      command.raw,
      "scene",
      "No active session",
      dependencies.values,
    );
  return {
    type: "insertSceneContainer",
    payload: {
      id: dependencies.values.id("scene"),
      description: "",
      descriptionLocked: false,
    },
  };
}

export function executeCombatCommand(
  command: Extract<ParsedCommand, { type: "combat" }>,
  context: CommandExecutionContext,
  { effects, values }: Dependencies,
): CommandExecutionResult {
  const snapshot = effects.snapshot();
  if (!snapshot.hasActiveSession)
    return errorResult(command.raw, "combat", "No active session", values);
  if (command.action === "begin") {
    effects.requestCombatPanel("open");
    effects.startCombat();
    const combatants = snapshot.combatState?.combatants ?? [];
    const currentTurnIndex = snapshot.combatState?.currentTurnIndex ?? 0;
    const roundNumber = snapshot.combatState?.roundNumber ?? 1;
    const first = combatants[currentTurnIndex];
    return {
      type: "insertCombatSpace",
      payload: {
        id: values.id("combat"),
        active: true,
        ended: false,
        currentTurnIndex,
        roundNumber,
      },
      initialTurn:
        combatants.length >= 2 && first
          ? combatTurn(values, {
              combatantId: first.id,
              combatantName: first.name,
              roundNumber,
              turnIndex: currentTurnIndex,
              current: true,
            })
          : undefined,
    };
  }
  if (!context.isInsideCombatSpace)
    return errorResult(
      command.raw,
      "combat",
      "Use this combat command inside a combat space",
      values,
    );
  if (command.action === "end") {
    effects.saveCombatState({ active: false });
    effects.requestCombatPanel("closed");
    return { type: "endCombat" };
  }
  const state = snapshot.combatState;
  if (!state || state.combatants.length < 2) return { type: "deleteCommand" };
  const currentTurnIndex =
    command.action === "turn"
      ? getNextTurnIndex(state.currentTurnIndex, state.combatants.length)
      : state.currentTurnIndex;
  const roundNumber =
    command.action === "turn"
      ? getNextRoundNumber(
          state.currentTurnIndex,
          state.combatants.length,
          state.roundNumber,
        )
      : state.roundNumber;
  const active = state.combatants[currentTurnIndex];
  if (!active) return { type: "deleteCommand" };
  if (command.action === "turn")
    effects.saveCombatState({ currentTurnIndex, roundNumber });
  return {
    type: "insertCombatTurn",
    combatSpacePayload: {
      active: true,
      ended: false,
      currentTurnIndex,
      roundNumber,
    },
    turnPayload: combatTurn(values, {
      combatantId: active.id,
      combatantName: active.name,
      roundNumber,
      turnIndex: currentTurnIndex,
      current: true,
    }),
    collapseCurrentTurn: command.action === "turn",
  };
}
