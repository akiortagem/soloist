import { describe, expect, it } from "vitest";

import type {
  ParsedAskCommand,
  ParsedInvalidCommand,
  ParsedRollCommand,
} from "../commands/commandTypes";
import {
  createAskCommandResultBlock,
  createInvalidCommandResultBlock,
  createRollCommandResultBlock,
} from "../editor/resultBlocks/createResultBlock";

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

describe("command result blocks", () => {
  it("creates a roll result block from a parsed /roll command", () => {
    const command: ParsedRollCommand = {
      type: "roll",
      raw: "/roll d20",
      formula: "d20",
    };

    const block = createRollCommandResultBlock(command);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("roll");
    expect(block.commandText).toBe("/roll d20");
    expect(block.collapsed).toBeUndefined();
    expect(payload.formula).toBe("d20");
    expect(typeof payload.total).toBe("number");
    expect(Array.isArray(payload.terms)).toBe(true);
  });

  it("creates an error result block from an invalid parsed command", () => {
    const command: ParsedInvalidCommand = {
      type: "invalid",
      raw: "/roll",
      commandName: "roll",
      reason: "Missing dice formula",
    };

    const block = createInvalidCommandResultBlock(command);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("error");
    expect(block.commandText).toBe("/roll");
    expect(payload.commandName).toBe("roll");
    expect(payload.reason).toBe("Missing dice formula");
  });

  it("creates an oracle result block from a parsed /ask command", () => {
    const command: ParsedAskCommand = {
      type: "ask",
      raw: "/ask likely Is the guard asleep?",
      odds: "likely",
      question: "Is the guard asleep?",
    };

    const block = createAskCommandResultBlock(command);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("oracle");
    expect(block.commandText).toBe("/ask likely Is the guard asleep?");
    expect(block.collapsed).toBe(true);
    expect(payload.question).toBe("Is the guard asleep?");
    expect(payload.odds).toBe("likely");
    expect(payload.answer === "Yes" || payload.answer === "No").toBe(true);
  });
});
