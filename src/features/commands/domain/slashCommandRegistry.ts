import type { ParsedCommand } from "./commandTypes";
import { askCommand } from "./core/askCommand";
import { chaosCommand } from "./core/chaosCommand";
import { combatCommand } from "./core/combatCommand";
import { rollCommand } from "./core/rollCommand";
import { sceneCommand } from "./core/sceneCommand";
import { statCommand } from "./core/statCommand";

export type SlashCommandSource = "core" | "plugin";

export type SlashCommandParser = (input: {
  raw: string;
  commandName: string;
  argsText: string;
}) => ParsedCommand;

export type SlashCommandDefinition = {
  id: string;
  name: string;
  label: string;
  description?: string;
  prefix: string;
  commandText?: string;
  source: SlashCommandSource;
  pluginId?: string;
  tableId?: string;
  parse?: SlashCommandParser;
};

const CORE_SLASH_COMMANDS: SlashCommandDefinition[] = [
  rollCommand,
  askCommand,
  sceneCommand,
  combatCommand,
  statCommand,
  chaosCommand,
];

export class SlashCommandRegistry {
  private readonly commands = new Map<string, SlashCommandDefinition>();
  private readonly commandsByName = new Map<string, SlashCommandDefinition>();

  constructor(commands: SlashCommandDefinition[] = []) {
    for (const command of commands) {
      this.register(command);
    }
  }

  register(command: SlashCommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Slash command already registered: ${command.id}`);
    }

    const normalizedName = command.name.toLowerCase();

    if (this.commandsByName.has(normalizedName)) {
      throw new Error(
        `Slash command already registered for name: ${command.name}`,
      );
    }

    if (command.source === "plugin" && !command.pluginId) {
      throw new Error(`Plugin slash command requires pluginId: ${command.id}`);
    }

    const storedCommand = { ...command, name: normalizedName };
    this.commands.set(command.id, storedCommand);
    this.commandsByName.set(normalizedName, storedCommand);
  }

  list(): SlashCommandDefinition[] {
    return Array.from(this.commands.values(), (command) => ({ ...command }));
  }

  get(id: string): SlashCommandDefinition | undefined {
    const command = this.commands.get(id);
    return command ? { ...command } : undefined;
  }

  getByName(name: string): SlashCommandDefinition | undefined {
    const command = this.commandsByName.get(name.toLowerCase());
    return command ? { ...command } : undefined;
  }

  unregisterPlugin(pluginId: string): void {
    for (const command of this.commands.values()) {
      if (command.source !== "plugin" || command.pluginId !== pluginId) {
        continue;
      }

      this.commands.delete(command.id);
      this.commandsByName.delete(command.name);
    }
  }
}

export const coreSlashCommands = CORE_SLASH_COMMANDS.map((command) => ({
  ...command,
}));

export const slashCommandRegistry = new SlashCommandRegistry(coreSlashCommands);
