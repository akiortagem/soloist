import { describe, expect, it } from "vitest";
import { parseCommand } from "../commands/parseCommand";
import {
  extractCommandName,
  normalizeWhitespace,
  parseQuotedString,
  startsWithSlash,
  tokenizeArgs,
  trimCommandInput,
} from "../commands/parserUtils";

describe("command parser foundation", () => {
  it("handles an empty string safely", () => {
    expect(parseCommand("")).toEqual({
      type: "unknown",
      raw: "",
      reason: "Command input is empty",
    });
  });

  it("handles text that does not start with slash", () => {
    expect(parseCommand("roll 1d20+3")).toEqual({
      type: "unknown",
      raw: "roll 1d20+3",
      reason: "Command input must start with /",
    });
  });

  it("parses /roll 1d20", () => {
    expect(parseCommand("/roll 1d20")).toEqual({
      type: "roll",
      raw: "/roll 1d20",
      formula: "1d20",
    });
  });

  it("parses /roll d20", () => {
    expect(parseCommand("/roll d20")).toEqual({
      type: "roll",
      raw: "/roll d20",
      formula: "d20",
    });
  });

  it("parses /roll 1d20+3", () => {
    expect(parseCommand("/roll 1d20+3")).toEqual({
      type: "roll",
      raw: "/roll 1d20+3",
      formula: "1d20+3",
    });
  });

  it("parses /roll 2d6 - 1", () => {
    expect(parseCommand("/roll 2d6 - 1")).toEqual({
      type: "roll",
      raw: "/roll 2d6 - 1",
      formula: "2d6 - 1",
    });
  });

  it("parses /roll 1d20 + 1d4 + 2", () => {
    expect(parseCommand("/roll 1d20 + 1d4 + 2")).toEqual({
      type: "roll",
      raw: "/roll 1d20 + 1d4 + 2",
      formula: "1d20 + 1d4 + 2",
    });
  });

  it("returns invalid when /roll is missing a formula", () => {
    expect(parseCommand("/roll")).toEqual({
      type: "invalid",
      raw: "/roll",
      commandName: "roll",
      reason: "Missing dice formula",
    });
  });

  it("returns invalid when /roll only has trailing whitespace", () => {
    expect(parseCommand("/roll    ")).toEqual({
      type: "invalid",
      raw: "/roll    ",
      commandName: "roll",
      reason: "Missing dice formula",
    });
  });

  it("parses /ask with default odds", () => {
    expect(parseCommand("/ask Is the door locked?")).toEqual({
      type: "ask",
      raw: "/ask Is the door locked?",
      odds: "50_50",
      question: "Is the door locked?",
    });
  });

  it("parses /ask with one-word odds aliases", () => {
    expect(parseCommand("/ask likely Is the guard asleep?")).toEqual({
      type: "ask",
      raw: "/ask likely Is the guard asleep?",
      odds: "likely",
      question: "Is the guard asleep?",
    });
    expect(parseCommand("/ask unlikely Is the merchant lying?")).toEqual({
      type: "ask",
      raw: "/ask unlikely Is the merchant lying?",
      odds: "unlikely",
      question: "Is the merchant lying?",
    });
    expect(parseCommand("/ask very_likely Is the town nearby?")).toEqual({
      type: "ask",
      raw: "/ask very_likely Is the town nearby?",
      odds: "very_likely",
      question: "Is the town nearby?",
    });
    expect(parseCommand("/ask 50/50 Is someone watching me?")).toEqual({
      type: "ask",
      raw: "/ask 50/50 Is someone watching me?",
      odds: "50_50",
      question: "Is someone watching me?",
    });
  });

  it("parses /ask with two-word odds aliases", () => {
    expect(parseCommand("/ask very likely Is the town nearby?")).toEqual({
      type: "ask",
      raw: "/ask very likely Is the town nearby?",
      odds: "very_likely",
      question: "Is the town nearby?",
    });
    expect(parseCommand("/ask no way Is this safe?")).toEqual({
      type: "ask",
      raw: "/ask no way Is this safe?",
      odds: "no_way",
      question: "Is this safe?",
    });
    expect(parseCommand("/ask near sure Is the tavern open?")).toEqual({
      type: "ask",
      raw: "/ask near sure Is the tavern open?",
      odds: "near_sure",
      question: "Is the tavern open?",
    });
  });

  it("parses /ask quoted whole questions", () => {
    expect(parseCommand('/ask "Is the guildmaster hiding something?"')).toEqual({
      type: "ask",
      raw: '/ask "Is the guildmaster hiding something?"',
      odds: "50_50",
      question: "Is the guildmaster hiding something?",
    });
  });

  it("returns invalid when /ask is missing a question", () => {
    expect(parseCommand("/ask likely")).toEqual({
      type: "invalid",
      raw: "/ask likely",
      commandName: "ask",
      reason: "Missing yes/no question",
    });
    expect(parseCommand("/ask")).toEqual({
      type: "invalid",
      raw: "/ask",
      commandName: "ask",
      reason: "Missing yes/no question",
    });
  });

  it("identifies scene commands with quoted args", () => {
    expect(parseCommand('/scene "I visit the guild"')).toMatchObject({
      type: "unknown",
      commandName: "scene",
    });
  });

  it("parses /stat with an unquoted sheet name and negative delta", () => {
    expect(parseCommand("/stat Kael HP -4")).toEqual({
      type: "stat",
      raw: "/stat Kael HP -4",
      sheetName: "Kael",
      statName: "HP",
      delta: -4,
    });
  });

  it("parses /stat with quoted sheet names", () => {
    expect(parseCommand('/stat "Kael Voss" HP -4')).toEqual({
      type: "stat",
      raw: '/stat "Kael Voss" HP -4',
      sheetName: "Kael Voss",
      statName: "HP",
      delta: -4,
    });
    expect(parseCommand('/stat "Bandit A" HP -2')).toEqual({
      type: "stat",
      raw: '/stat "Bandit A" HP -2',
      sheetName: "Bandit A",
      statName: "HP",
      delta: -2,
    });
  });

  it("parses /stat with a positive delta", () => {
    expect(parseCommand("/stat Kael Gold +50")).toEqual({
      type: "stat",
      raw: "/stat Kael Gold +50",
      sheetName: "Kael",
      statName: "Gold",
      delta: 50,
    });
  });

  it("returns invalid when /stat delta does not include a sign", () => {
    expect(parseCommand("/stat Kael HP 4")).toEqual({
      type: "invalid",
      raw: "/stat Kael HP 4",
      commandName: "stat",
      reason: "Stat delta must include + or -",
    });
  });

  it("returns invalid when /stat is missing required arguments", () => {
    expect(parseCommand("/stat Kael HP")).toEqual({
      type: "invalid",
      raw: "/stat Kael HP",
      commandName: "stat",
      reason: "Missing stat delta",
    });
    expect(parseCommand("/stat Kael")).toEqual({
      type: "invalid",
      raw: "/stat Kael",
      commandName: "stat",
      reason: "Missing stat name",
    });
    expect(parseCommand("/stat")).toEqual({
      type: "invalid",
      raw: "/stat",
      commandName: "stat",
      reason: "Missing character sheet name",
    });
  });

  it("returns invalid when /stat uses an unsupported multi-token stat name", () => {
    expect(parseCommand("/stat Kael Hit Points -4")).toEqual({
      type: "invalid",
      raw: "/stat Kael Hit Points -4",
      commandName: "stat",
      reason: "Stat names with spaces are not supported",
    });
    expect(parseCommand('/stat Kael "Hit Points" -4')).toEqual({
      type: "invalid",
      raw: '/stat Kael "Hit Points" -4',
      commandName: "stat",
      reason: "Stat names with spaces are not supported",
    });
  });

  it("returns invalid when /stat delta is not numeric", () => {
    expect(parseCommand("/stat Kael HP nope")).toEqual({
      type: "invalid",
      raw: "/stat Kael HP nope",
      commandName: "stat",
      reason: "Stat delta must include + or -",
    });
  });

  it("parses /chaos with signed integer deltas", () => {
    expect(parseCommand("/chaos +1")).toEqual({
      type: "chaos",
      raw: "/chaos +1",
      delta: 1,
    });
    expect(parseCommand("/chaos -1")).toEqual({
      type: "chaos",
      raw: "/chaos -1",
      delta: -1,
    });
    expect(parseCommand("/chaos +2")).toEqual({
      type: "chaos",
      raw: "/chaos +2",
      delta: 2,
    });
    expect(parseCommand("/chaos -3")).toEqual({
      type: "chaos",
      raw: "/chaos -3",
      delta: -3,
    });
  });

  it("returns invalid when /chaos is missing a delta", () => {
    expect(parseCommand("/chaos")).toEqual({
      type: "invalid",
      raw: "/chaos",
      commandName: "chaos",
      reason: "Missing chaos delta",
    });
  });

  it("returns invalid when /chaos delta does not include a sign", () => {
    expect(parseCommand("/chaos 1")).toEqual({
      type: "invalid",
      raw: "/chaos 1",
      commandName: "chaos",
      reason: "Chaos delta must include + or -",
    });
  });

  it("returns invalid when /chaos delta is not numeric", () => {
    expect(parseCommand("/chaos nope")).toEqual({
      type: "invalid",
      raw: "/chaos nope",
      commandName: "chaos",
      reason: "Chaos delta must include + or -",
    });
  });

  it("returns invalid when /chaos has extra arguments", () => {
    expect(parseCommand("/chaos +1 now")).toEqual({
      type: "invalid",
      raw: "/chaos +1 now",
      commandName: "chaos",
      reason: "Chaos command accepts exactly one argument",
    });
  });
});

describe("parser utilities", () => {
  it("trims command input and checks slash prefix", () => {
    expect(trimCommandInput("  /roll 1d20  ")).toBe("/roll 1d20");
    expect(startsWithSlash("  /roll")).toBe(true);
    expect(startsWithSlash("roll")).toBe(false);
  });

  it("extracts command names and args", () => {
    expect(extractCommandName("/roll 1d20+3")).toEqual({
      commandName: "roll",
      argsText: "1d20+3",
    });
  });

  it("parses quoted strings", () => {
    expect(parseQuotedString('"Kael Voss" HP -4')).toEqual({
      value: "Kael Voss",
      rest: "HP -4",
    });
  });

  it("tokenizes arguments while preserving quoted phrases", () => {
    expect(tokenizeArgs("Kael HP -4")).toEqual(["Kael", "HP", "-4"]);
    expect(tokenizeArgs('"Kael Voss" HP -4')).toEqual([
      "Kael Voss",
      "HP",
      "-4",
    ]);
  });

  it("normalizes multiple whitespace characters", () => {
    expect(normalizeWhitespace("  /ask   likely\tIs the guard asleep?  ")).toBe(
      "/ask likely Is the guard asleep?",
    );
  });
});
