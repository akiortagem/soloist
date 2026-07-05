import type { SlashCommandDefinition } from "../slashCommandRegistry";

export const sceneCommand: SlashCommandDefinition = {
  id: "core.scene",
  name: "scene",
  label: "Start Scene",
  description: "Start a new scene container.",
  prefix: "/scene",
  source: "core",
  parse({ raw, commandName, argsText }) {
    if (argsText.length > 0) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: "Scene command does not accept arguments",
      };
    }

    return {
      type: "scene",
      raw,
    };
  },
};
