import {
  type SlashCommandDefinition,
  type SlashCommandRegistry,
} from "../../commands";
import type { ScriptPluginRuntime } from "../../../plugins/scriptPluginRuntime";
import { validateSlashCommandRegistration } from "../../../plugins/pluginValidation";
import { ContributionTransaction } from "../application/ContributionTransaction";

export async function registerScriptCommands(input: {
  pluginId: string;
  commands: unknown[];
  registry: SlashCommandRegistry;
  runtime: ScriptPluginRuntime;
}): Promise<number> {
  const transaction = new ContributionTransaction();
  const ids = new Set<string>();
  const names = new Set<string>();
  try {
    for (const rawCommand of input.commands) {
      const command = validateSlashCommandRegistration(rawCommand);
      assertUnique(command.id, command.name, ids, names);
      input.registry.register({
        id: `${input.pluginId}:${command.id}`,
        name: command.name,
        label: command.label,
        description: command.description,
        prefix: command.prefix,
        source: "plugin",
        pluginId: input.pluginId,
        parse: ({ raw, commandName, argsText }) => ({
          type: "scriptPlugin",
          raw,
          commandName,
          pluginId: input.pluginId,
          commandId: command.id,
          argsText,
          args: splitArgs(argsText),
          execute: (context) =>
            input.runtime.executeCommand(input.pluginId, command.id, context),
        }),
      } satisfies SlashCommandDefinition);
      transaction.add(() => input.registry.unregisterPlugin(input.pluginId));
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
  transaction.commit();
  return ids.size;
}

function assertUnique(
  id: string,
  name: string,
  ids: Set<string>,
  names: Set<string>,
): void {
  if (ids.has(id)) throw new Error(`Duplicate slash command id: ${id}`);
  const normalizedName = name.toLowerCase();
  if (names.has(normalizedName))
    throw new Error(`Duplicate slash command name: ${name}`);
  ids.add(id);
  names.add(normalizedName);
}

function splitArgs(argsText: string): string[] {
  const trimmed = argsText.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}
