import { describe, expect, it } from "vitest";

import type {
  ParsedAskCommand,
  ParsedChaosCommand,
  ParsedInvalidCommand,
  ParsedRollCommand,
  ParsedStatCommand,
} from "../commands/commandTypes";
import {
  createAskCommandResultBlock,
  createChaosCommandResultBlock,
  createInvalidCommandResultBlock,
  createRollCommandResultBlock,
  createStatCommandResultBlock,
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

    const block = createAskCommandResultBlock(command, 7);
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("oracle");
    expect(block.commandText).toBe("/ask likely Is the guard asleep?");
    expect(block.collapsed).toBe(true);
    expect(payload.question).toBe("Is the guard asleep?");
    expect(payload.odds).toBe("likely");
    expect(payload.chaosFactor).toBe(7);
    expect(payload.answer === "Yes" || payload.answer === "No").toBe(true);
  });

  it("creates a stat result block from a parsed /stat command", () => {
    const command: ParsedStatCommand = {
      type: "stat",
      raw: "/stat Kael HP -4",
      sheetName: "Kael",
      statName: "HP",
      delta: -4,
    };

    const block = createStatCommandResultBlock(command, {
      ok: true,
      sheetName: "Kael",
      statName: "HP",
      delta: -4,
      beforeValue: 16,
      afterValue: 12,
    });
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("stat");
    expect(block.commandText).toBe("/stat Kael HP -4");
    expect(payload.sheet).toBe("Kael");
    expect(payload.stat).toBe("HP");
    expect(payload.delta).toBe(-4);
    expect(payload.beforeValue).toBe(16);
    expect(payload.afterValue).toBe(12);
  });

  it("creates a chaos result block from a parsed /chaos command", () => {
    const command: ParsedChaosCommand = {
      type: "chaos",
      raw: "/chaos +1",
      delta: 1,
    };

    const block = createChaosCommandResultBlock(command, {
      ok: true,
      delta: 1,
      beforeValue: 4,
      afterValue: 5,
    });
    const payload = payloadRecord(block.payload);

    expect(block.type).toBe("chaos");
    expect(block.commandText).toBe("/chaos +1");
    expect(payload.delta).toBe(1);
    expect(payload.beforeValue).toBe(4);
    expect(payload.afterValue).toBe(5);
  });
});
