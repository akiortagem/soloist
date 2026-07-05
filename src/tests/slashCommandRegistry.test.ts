import { describe, expect, it } from "vitest";
import {
  SlashCommandRegistry,
  coreSlashCommands,
  slashCommandRegistry,
  type SlashCommandDefinition,
} from "../commands/slashCommandRegistry";

describe("slash command registry", () => {
  it("registers the core slash commands in menu order", () => {
    expect(slashCommandRegistry.list()).toMatchObject([
      {
        id: "core.roll",
        name: "roll",
        label: "Roll Dice",
        prefix: "/roll ",
        source: "core",
      },
      {
        id: "core.ask",
        name: "ask",
        label: "Ask Oracle",
        prefix: "/ask ",
        source: "core",
      },
      {
        id: "core.scene",
        name: "scene",
        label: "Start Scene",
        prefix: "/scene",
        source: "core",
      },
      {
        id: "core.combat",
        name: "combat",
        label: "Start Combat",
        prefix: "/combat",
        source: "core",
      },
      {
        id: "core.stat",
        name: "stat",
        label: "Modify Stat",
        prefix: "/stat ",
        source: "core",
      },
      {
        id: "core.chaos",
        name: "chaos",
        label: "Modify Chaos",
        prefix: "/chaos ",
        source: "core",
      },
    ]);
  });

  it("lists defensive copies of registered commands", () => {
    const registry = new SlashCommandRegistry(coreSlashCommands);
    const commands = registry.list();

    commands[0].label = "Changed";

    expect(registry.get("core.roll")?.label).toBe("Roll Dice");
  });

  it("requires plugin commands to include a plugin id", () => {
    const registry = new SlashCommandRegistry();
    const pluginCommand: SlashCommandDefinition = {
      id: "plugin.example",
      name: "example",
      label: "Example",
      prefix: "/example",
      source: "plugin",
    };

    expect(() => registry.register(pluginCommand)).toThrow(
      "Plugin slash command requires pluginId: plugin.example",
    );
  });
});
