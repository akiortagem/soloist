import { describe, expect, it } from "vitest";

import { parseDiceFormula } from "../dice/diceParser";
import { rollDice } from "../dice/rollDice";
import type { RandomNumberGenerator } from "../dice/diceTypes";

function sequenceRng(values: number[]): RandomNumberGenerator {
  let index = 0;

  return () => {
    const value = values[index];
    index += 1;
    return value ?? 0;
  };
}

describe("parseDiceFormula", () => {
  it("normalizes d20 to 1d20", () => {
    const result = parseDiceFormula("d20");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.terms[0]).toMatchObject({ type: "dice", count: 1, sides: 20 });
  });

  it("parses dice, modifiers, keep, and explode syntax", () => {
    const result = parseDiceFormula(" 5d8kh2e8 + 2 ");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.formula).toBe("5d8kh2e8+2");
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      count: 5,
      sides: 8,
      keep: { mode: "highest", count: 2 },
      explodeOn: 8,
    });
    expect(result.value.terms[1]).toMatchObject({ type: "modifier", value: 2 });
  });

  it("returns typed errors for invalid formulas", () => {
    expect(parseDiceFormula("cat")).toMatchObject({
      ok: false,
      error: { code: "INVALID_FORMULA" },
    });
    expect(parseDiceFormula("101d6")).toMatchObject({
      ok: false,
      error: { code: "TOO_MANY_DICE" },
    });
    expect(parseDiceFormula("1d10001")).toMatchObject({
      ok: false,
      error: { code: "TOO_MANY_SIDES" },
    });
    expect(parseDiceFormula("1d6".repeat(34))).toMatchObject({
      ok: false,
      error: { code: "FORMULA_TOO_LONG" },
    });
  });
});

describe("rollDice", () => {
  it("rolls 1d20", () => {
    const result = rollDice("1d20", sequenceRng([0.7]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(15);
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      rolls: [{ value: 15, kept: true, exploded: false }],
      keptValues: [15],
    });
  });

  it("rolls d20 as one die", () => {
    const result = rollDice("d20", sequenceRng([0]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.formula).toBe("d20");
    expect(result.value.total).toBe(1);
  });

  it("rolls formulas with positive and negative modifiers", () => {
    const plus = rollDice("1d20+3", sequenceRng([0.95]));
    const minus = rollDice("2d6-1", sequenceRng([0, 0.999]));

    expect(plus.ok).toBe(true);
    expect(minus.ok).toBe(true);
    if (!plus.ok || !minus.ok) return;
    expect(plus.value.total).toBe(23);
    expect(minus.value.total).toBe(6);
  });

  it("rolls multiple dice terms and modifiers", () => {
    const result = rollDice("1d20+1d4+2", sequenceRng([0.45, 0.5]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(15);
    expect(result.value.terms).toHaveLength(3);
  });

  it("explodes kept dice on the configured target", () => {
    const result = rollDice("1d20e20", sequenceRng([0.999, 0.25]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(26);
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      rolls: [
        { value: 20, kept: true, exploded: true },
        { value: 6, kept: true, exploded: false },
      ],
      keptValues: [20, 6],
    });
  });

  it("keeps highest dice before totaling", () => {
    const result = rollDice("3d10kh2", sequenceRng([0, 0.9, 0.4]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(15);
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      keptValues: [10, 5],
    });
  });

  it("keeps lowest dice before totaling", () => {
    const result = rollDice("4d8kl2", sequenceRng([0.875, 0, 0.375, 0.5]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(5);
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      keptValues: [1, 4],
    });
  });

  it("resolves keep highest before explosion", () => {
    const result = rollDice("5d8kh2e8", sequenceRng([0.875, 0, 0.75, 0.875, 0.5, 0.25, 0.125]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.total).toBe(21);
    expect(result.value.terms[0]).toMatchObject({
      type: "dice",
      keptValues: [8, 3, 8, 2],
    });
    expect(result.value.terms[0]).toMatchObject({
      rolls: [
        { value: 8, kept: true, exploded: true },
        { value: 1, kept: false },
        { value: 7, kept: false },
        { value: 8, kept: true, exploded: true },
        { value: 5, kept: false },
        { value: 3, kept: true },
        { value: 2, kept: true },
      ],
    });
  });
});
