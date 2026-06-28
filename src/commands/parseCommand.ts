import type { ParsedCommand } from "./commandTypes";
import type { OracleOdds } from "../oracle/oracleTypes";
import {
  extractCommandName,
  parseQuotedString,
  startsWithSlash,
  tokenizeArgs,
  trimCommandInput,
} from "./parserUtils";

const DEFAULT_ORACLE_ODDS: OracleOdds = "50_50";

const oracleOddsAliases = new Map<string, OracleOdds>([
  ["impossible", "impossible"],
  ["no_way", "no_way"],
  ["no way", "no_way"],
  ["very_unlikely", "very_unlikely"],
  ["very unlikely", "very_unlikely"],
  ["unlikely", "unlikely"],
  ["50/50", "50_50"],
  ["50_50", "50_50"],
  ["fifty_fifty", "50_50"],
  ["fifty fifty", "50_50"],
  ["likely", "likely"],
  ["very_likely", "very_likely"],
  ["very likely", "very_likely"],
  ["near_sure", "near_sure"],
  ["near sure", "near_sure"],
  ["sure_thing", "sure_thing"],
  ["sure thing", "sure_thing"],
]);

function parseAskArgs(argsText: string):
  | { ok: true; odds: OracleOdds; question: string }
  | { ok: false; reason: string } {
  let remaining = argsText.trim();
  let odds = DEFAULT_ORACLE_ODDS;

  if (remaining.length === 0) {
    return { ok: false, reason: "Missing yes/no question" };
  }

  const firstTwoWords = /^(\S+)\s+(\S+)(?:\s+([\s\S]*))?$/.exec(remaining);
  if (firstTwoWords) {
    const alias = `${firstTwoWords[1]} ${firstTwoWords[2]}`.toLowerCase();
    const parsedOdds = oracleOddsAliases.get(alias);

    if (parsedOdds) {
      odds = parsedOdds;
      remaining = (firstTwoWords[3] ?? "").trim();
    }
  }

  if (odds === DEFAULT_ORACLE_ODDS) {
    const firstWord = /^(\S+)(?:\s+([\s\S]*))?$/.exec(remaining);
    if (firstWord) {
      const parsedOdds = oracleOddsAliases.get(firstWord[1].toLowerCase());

      if (parsedOdds) {
        odds = parsedOdds;
        remaining = (firstWord[2] ?? "").trim();
      }
    }
  }

  if (remaining.startsWith('"')) {
    const parsedQuestion = parseQuotedString(remaining);
    if (parsedQuestion.error) {
      return { ok: false, reason: parsedQuestion.error };
    }

    remaining = parsedQuestion.value?.trim() ?? "";

    if (parsedQuestion.rest.length > 0) {
      remaining = `${remaining} ${parsedQuestion.rest}`.trim();
    }
  }

  if (remaining.length === 0) {
    return { ok: false, reason: "Missing yes/no question" };
  }

  return {
    ok: true,
    odds,
    question: remaining,
  };
}

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

function parseChaosArgs(argsText: string):
  | { ok: true; delta: number }
  | { ok: false; reason: string } {
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

export function parseCommand(raw: string): ParsedCommand {
  const trimmed = trimCommandInput(raw);

  if (trimmed.length === 0) {
    return {
      type: "unknown",
      raw,
      reason: "Command input is empty",
    };
  }

  if (!startsWithSlash(trimmed)) {
    return {
      type: "unknown",
      raw,
      reason: "Command input must start with /",
    };
  }

  const { commandName, argsText } = extractCommandName(trimmed);

  if (commandName === "roll") {
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
  }

  if (commandName === "ask") {
    const parsedAsk = parseAskArgs(argsText);

    if (!parsedAsk.ok) {
      return {
        type: "invalid",
        raw,
        commandName,
        reason: parsedAsk.reason,
      };
    }

    return {
      type: "ask",
      raw,
      odds: parsedAsk.odds,
      question: parsedAsk.question,
    };
  }

  if (commandName === "stat") {
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
  }

  if (commandName === "chaos") {
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
  }

  if (commandName === "scene") {
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
  }

  if (commandName === "combat") {
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
  }

  return {
    type: "unknown",
    raw,
    commandName,
    reason: commandName
      ? "Command parser not implemented yet"
      : "Command name is missing",
  };
}
