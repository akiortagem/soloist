import type { SlashCommandDefinition } from "../slashCommandRegistry";

export const rollCommand: SlashCommandDefinition = {
  id: "core.roll",
  name: "roll",
  label: "Roll Dice",
  description: "Roll dice from a dice formula.",
  prefix: "/roll ",
  source: "core",
  parse({ raw, commandName, argsText }) {
    if (argsText.length === 0) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: "Missing dice formula",
      };
    }

    return {
      type: "roll",
      raw,
      formula: argsText,
    };
  },
};
