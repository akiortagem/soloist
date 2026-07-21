import { describe, expect, it } from "vitest";

import { SlashCommandRegistry } from "../../commands";
import type { ScriptPluginRuntime } from "../../../plugins/scriptPluginRuntime";
import { registerScriptCommands } from "./ScriptCommandRegistrar";

const runtime: ScriptPluginRuntime = {
  async activatePlugin() {
    return { slashCommands: [] };
  },
  async executeCommand() {
    return { type: "deleteCommand" };
  },
  deactivatePlugin() {},
};

describe("registerScriptCommands", () => {
  it("rolls back commands registered before a later contribution fails", async () => {
    const registry = new SlashCommandRegistry();

    await expect(
      registerScriptCommands({
        pluginId: "partial",
        registry,
        runtime,
        commands: [
          { id: "same", name: "first", label: "First", prefix: "/first" },
          { id: "same", name: "second", label: "Second", prefix: "/second" },
        ],
      }),
    ).rejects.toThrow("Duplicate slash command id: same");

    expect(registry.list()).toEqual([]);
  });
});
