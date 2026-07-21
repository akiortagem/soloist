import { tokenizeArgs } from "../parserUtils";
import type { SlashCommandDefinition } from "../slashCommandRegistry";

function parseChaosArgs(
  argsText: string,
): { ok: true; delta: number } | { ok: false; reason: string } {
  const tokens = tokenizeArgs(argsText.trim());

  if (tokens.length === 0) {
    return { ok: false, reason: "Missing chaos delta" };
  }

  if (tokens.length > 1) {
    return { ok: false, reason: "Chaos command accepts exactly one argument" };
  }

  const [deltaText] = tokens;

  if (!/^[+-]/.test(deltaText)) {
    return { ok: false, reason: "Chaos delta must include + or -" };
  }

  if (!/^[+-]\d+$/.test(deltaText)) {
    return { ok: false, reason: "Chaos delta must be a signed integer" };
  }

  return {
    ok: true,
    delta: Number(deltaText),
  };
}

export const chaosCommand: SlashCommandDefinition = {
  id: "core.chaos",
  name: "chaos",
  label: "Modify Chaos",
  description: "Apply a chaos factor change.",
  prefix: "/chaos ",
  source: "core",
  parse({ raw, commandName, argsText }) {
    const parsedChaos = parseChaosArgs(argsText);

    if (!parsedChaos.ok) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: parsedChaos.reason,
      };
    }

    return {
      type: "chaos",
      raw,
      delta: parsedChaos.delta,
    };
  },
};
