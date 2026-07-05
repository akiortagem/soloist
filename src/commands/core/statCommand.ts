import { parseQuotedString, tokenizeArgs } from "../parserUtils";
import type { SlashCommandDefinition } from "../slashCommandRegistry";

function parseStatArgs(argsText: string):
  | { ok: true; sheetName: string; statName: string; delta: number }
  | { ok: false; reason: string } {
  let remaining = argsText.trim();

  if (remaining.length === 0) {
    return { ok: false, reason: "Missing character sheet name" };
  }

  let sheetName = "";

  if (remaining.startsWith('"')) {
    const parsedSheetName = parseQuotedString(remaining);

    if (parsedSheetName.error) {
      return { ok: false, reason: parsedSheetName.error };
    }

    sheetName = parsedSheetName.value ?? "";
    remaining = parsedSheetName.rest.trim();
  } else {
    const firstToken = /^(\S+)(?:\s+([\s\S]*))?$/.exec(remaining);

    if (!firstToken) {
      return { ok: false, reason: "Missing character sheet name" };
    }

    sheetName = firstToken[1];
    remaining = (firstToken[2] ?? "").trim();
  }

  if (sheetName.trim().length === 0) {
    return { ok: false, reason: "Missing character sheet name" };
  }

  const tokens = tokenizeArgs(remaining);

  if (tokens.length === 0 || tokens[0].trim().length === 0) {
    return { ok: false, reason: "Missing stat name" };
  }

  if (tokens.length === 1) {
    return { ok: false, reason: "Missing stat delta" };
  }

  if (tokens.length > 2) {
    return { ok: false, reason: "Stat names with spaces are not supported" };
  }

  const [statName, deltaText] = tokens;

  if (/\s/.test(statName)) {
    return { ok: false, reason: "Stat names with spaces are not supported" };
  }

  if (!/^[+-]/.test(deltaText)) {
    return { ok: false, reason: "Stat delta must include + or -" };
  }

  if (!/^[+-]\d+(?:\.\d+)?$/.test(deltaText)) {
    return { ok: false, reason: "Stat delta must be numeric" };
  }

  return {
    ok: true,
    sheetName,
    statName,
    delta: Number(deltaText),
  };
}

function parseTrackerStatArgs(argsText: string):
  | {
      ok: true;
      characterName: string;
      statName: string;
      mode: "increment" | "absolute";
      value: number;
    }
  | { ok: false; reason: string } {
  let remaining = argsText.trim();

  if (!/^tracker(?:\s|$)/i.test(remaining)) {
    return { ok: false, reason: "Tracker stat command must start with tracker" };
  }

  remaining = remaining.replace(/^tracker/i, "").trim();

  if (remaining.length === 0) {
    return { ok: false, reason: "Missing tracker character name" };
  }

  let characterName = "";

  if (remaining.startsWith('"')) {
    const parsedCharacterName = parseQuotedString(remaining);

    if (parsedCharacterName.error) {
      return { ok: false, reason: parsedCharacterName.error };
    }

    characterName = parsedCharacterName.value ?? "";
    remaining = parsedCharacterName.rest.trim();
  } else {
    const firstToken = /^(\S+)(?:\s+([\s\S]*))?$/.exec(remaining);

    if (!firstToken) {
      return { ok: false, reason: "Missing tracker character name" };
    }

    characterName = firstToken[1];
    remaining = (firstToken[2] ?? "").trim();
  }

  if (characterName.trim().length === 0) {
    return { ok: false, reason: "Missing tracker character name" };
  }

  const tokens = tokenizeArgs(remaining);

  if (tokens.length === 0 || tokens[0].trim().length === 0) {
    return { ok: false, reason: "Missing tracker stat name" };
  }

  if (tokens.length === 1) {
    return { ok: false, reason: "Missing tracker stat value" };
  }

  if (tokens.length > 2) {
    return { ok: false, reason: "Tracker stat names with spaces are not supported" };
  }

  const [statName, valueText] = tokens;

  if (/\s/.test(statName)) {
    return { ok: false, reason: "Tracker stat names with spaces are not supported" };
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(valueText)) {
    return { ok: false, reason: "Tracker stat value must be numeric" };
  }

  return {
    ok: true,
    characterName,
    statName,
    mode: /^[+-]/.test(valueText) ? "increment" : "absolute",
    value: Number(valueText),
  };
}

export const statCommand: SlashCommandDefinition = {
  id: "core.stat",
  name: "stat",
  label: "Modify Stat",
  description: "Apply a stat change.",
  prefix: "/stat ",
  source: "core",
  parse({ raw, commandName, argsText }) {
    if (/^tracker(?:\s|$)/i.test(argsText.trim())) {
      const parsedTrackerStat = parseTrackerStatArgs(argsText);

      if (!parsedTrackerStat.ok) {
        return {
          type: "invalid",
          raw,
          commandName,
          reason: parsedTrackerStat.reason,
        };
      }

      return {
        type: "trackerStat",
        raw,
        characterName: parsedTrackerStat.characterName,
        statName: parsedTrackerStat.statName,
        mode: parsedTrackerStat.mode,
        value: parsedTrackerStat.value,
      };
    }

    const parsedStat = parseStatArgs(argsText);

    if (!parsedStat.ok) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: parsedStat.reason,
      };
    }

    return {
      type: "stat",
      raw,
      sheetName: parsedStat.sheetName,
      statName: parsedStat.statName,
      delta: parsedStat.delta,
    };
  },
};
