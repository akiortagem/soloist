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

  it("identifies stat commands with quoted args", () => {
    expect(parseCommand('/stat "Kael Voss" HP -4')).toMatchObject({
      type: "unknown",
      commandName: "stat",
    });
  });

  it("identifies chaos commands", () => {
    expect(parseCommand("/chaos +1")).toMatchObject({
      type: "unknown",
      commandName: "chaos",
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
