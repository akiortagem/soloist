import type { ParsedCommand } from "./commandTypes";
import type { OracleOdds } from "../oracle/oracleTypes";
import {
  extractCommandName,
  parseQuotedString,
  startsWithSlash,
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

  return {
    type: "unknown",
    raw,
    commandName,
    reason: commandName
      ? "Command parser not implemented yet"
      : "Command name is missing",
  };
}
