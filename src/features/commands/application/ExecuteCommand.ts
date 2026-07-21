import type { ParsedCommand } from "../domain/commandTypes";
import type {
  CommandExecutionContext,
  CommandExecutionResult,
} from "../domain/CommandExecution";
import {
  executeBasicCommand,
  executeCombatCommand,
  executePluginCommand,
  executeSceneCommand,
} from "./commandHandlers";
import type { CommandEffects, CommandValues } from "./ports/CommandEffects";

export type ExecuteCommand = (
  command: ParsedCommand,
  context: CommandExecutionContext,
) => Promise<CommandExecutionResult>;

export function createExecuteCommand(dependencies: {
  effects: CommandEffects;
  values: CommandValues;
}): ExecuteCommand {
  return async (command, context) => {
    if (command.type === "scene")
      return executeSceneCommand(command, context, dependencies);
    if (command.type === "combat")
      return executeCombatCommand(command, context, dependencies);
    if (command.type === "scriptPlugin")
      return executePluginCommand(command, context, dependencies);
    return executeBasicCommand(command, context, dependencies);
  };
}
