export type SlashCommandSource = "core" | "plugin";

export type SlashCommandDefinition = {
  id: string;
  name: string;
  label: string;
  description?: string;
  prefix: string;
  source: SlashCommandSource;
  pluginId?: string;
};

const CORE_SLASH_COMMANDS: SlashCommandDefinition[] = [
  {
    id: "core.roll",
    name: "roll",
    label: "Roll Dice",
    description: "Roll dice from a dice formula.",
    prefix: "/roll ",
    source: "core",
  },
  {
    id: "core.ask",
    name: "ask",
    label: "Ask Oracle",
    description: "Ask a yes/no oracle question.",
    prefix: "/ask ",
    source: "core",
  },
  {
    id: "core.scene",
    name: "scene",
    label: "Start Scene",
    description: "Start a new scene container.",
    prefix: "/scene",
    source: "core",
  },
  {
    id: "core.combat",
    name: "combat",
    label: "Start Combat",
    description: "Start a combat space.",
    prefix: "/combat",
    source: "core",
  },
  {
    id: "core.stat",
    name: "stat",
    label: "Modify Stat",
    description: "Apply a stat change.",
    prefix: "/stat ",
    source: "core",
  },
  {
    id: "core.chaos",
    name: "chaos",
    label: "Modify Chaos",
    description: "Apply a chaos factor change.",
    prefix: "/chaos ",
    source: "core",
  },
];

export class SlashCommandRegistry {
  private readonly commands = new Map<string, SlashCommandDefinition>();

  constructor(commands: SlashCommandDefinition[] = []) {
    for (const command of commands) {
      this.register(command);
    }
  }

  register(command: SlashCommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Slash command already registered: ${command.id}`);
    }

    if (command.source === "plugin" && !command.pluginId) {
      throw new Error(`Plugin slash command requires pluginId: ${command.id}`);
    }

    this.commands.set(command.id, { ...command });
  }

  list(): SlashCommandDefinition[] {
    return Array.from(this.commands.values(), (command) => ({ ...command }));
  }

  get(id: string): SlashCommandDefinition | undefined {
    const command = this.commands.get(id);
    return command ? { ...command } : undefined;
  }
}

export const coreSlashCommands = CORE_SLASH_COMMANDS.map((command) => ({
  ...command,
}));

export const slashCommandRegistry = new SlashCommandRegistry(coreSlashCommands);
