import { tokenizeArgs } from "../parserUtils";
import type { SlashCommandDefinition } from "../slashCommandRegistry";

export const combatCommand: SlashCommandDefinition = {
  id: "core.combat",
  name: "combat",
  label: "Start Combat",
  description: "Start a combat space.",
  prefix: "/combat",
  source: "core",
  parse({ raw, commandName, argsText }) {
    const tokens = tokenizeArgs(argsText);

    if (tokens.length === 0) {
      return {
        type: "combat",
        raw,
        action: "begin",
      };
    }

    if (tokens.length > 1) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: "Combat command accepts one action",
      };
    }

    const action = tokens[0].toLocaleLowerCase();

    if (
      action === "begin" ||
      action === "turn" ||
      action === "block" ||
      action === "end"
    ) {
      return {
        type: "combat",
        raw,
        action,
      };
    }

    return {
      type: "invalid",
      raw,
      commandName,
      reason: "Unknown combat action",
    };
  },
};
