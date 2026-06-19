import {
  MAX_DICE_COUNT,
  MAX_DICE_SIDES,
  MAX_FORMULA_LENGTH,
  type DiceResult,
  type DiceRollError,
  type DiceTerm,
  type ModifierTerm,
  type ParsedDiceFormula,
  type ParsedDiceTerm,
} from "./diceTypes";

const diceTermPattern = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?(?:e(\d+))?$/i;
const modifierPattern = /^\d+$/;

function diceError(code: DiceRollError["code"], message: string): DiceResult<never> {
  return { ok: false, error: { code, message } };
}

export function parseDiceFormula(formula: string): DiceResult<ParsedDiceFormula> {
  const normalized = formula.replace(/\s+/g, "");

  if (normalized.length === 0) {
    return diceError("EMPTY_FORMULA", "Dice formula cannot be empty.");
  }

  if (normalized.length > MAX_FORMULA_LENGTH) {
    return diceError(
      "FORMULA_TOO_LONG",
      `Dice formula cannot exceed ${MAX_FORMULA_LENGTH} characters.`,
    );
  }

  if (!/^[+-]?(?:\d*d\d+(?:(?:kh|kl)\d+)?(?:e\d+)?|\d+)(?:[+-](?:\d*d\d+(?:(?:kh|kl)\d+)?(?:e\d+)?|\d+))*$/i.test(normalized)) {
    return diceError("INVALID_FORMULA", `Invalid dice formula: ${formula}`);
  }

  const terms: ParsedDiceTerm[] = [];
  const termMatches = normalized.matchAll(/([+-]?)([^+-]+)/g);

  for (const match of termMatches) {
    const sign: 1 | -1 = match[1] === "-" ? -1 : 1;
    const rawTerm = match[2];
    const notation = `${sign === -1 ? "-" : terms.length === 0 ? "" : "+"}${rawTerm}`;
    const diceMatch = rawTerm.match(diceTermPattern);

    if (diceMatch) {
      const count = diceMatch[1] === "" ? 1 : Number(diceMatch[1]);
      const sides = Number(diceMatch[2]);
      const keepOperator = diceMatch[3]?.toLowerCase();
      const keepCount = diceMatch[4] ? Number(diceMatch[4]) : undefined;
      const explodeOn = diceMatch[5] ? Number(diceMatch[5]) : undefined;

      const validationError = validateDiceTerm(count, sides, keepCount, explodeOn);
      if (validationError) {
        return validationError;
      }

      const term: DiceTerm = {
        type: "dice",
        sign,
        notation,
        count,
        sides,
      };

      if (keepOperator && keepCount !== undefined) {
        term.keep = {
          mode: keepOperator === "kh" ? "highest" : "lowest",
          count: keepCount,
        };
      }

      if (explodeOn !== undefined) {
        term.explodeOn = explodeOn;
      }

      terms.push(term);
      continue;
    }

    if (modifierPattern.test(rawTerm)) {
      const value = Number(rawTerm);
      const term: ModifierTerm = {
        type: "modifier",
        sign,
        notation,
        value,
      };
      terms.push(term);
      continue;
    }

    return diceError("INVALID_FORMULA", `Invalid dice term: ${rawTerm}`);
  }

  return { ok: true, value: { formula: normalized, terms } };
}

function validateDiceTerm(
  count: number,
  sides: number,
  keepCount?: number,
  explodeOn?: number,
): DiceResult<never> | undefined {
  if (!Number.isInteger(count) || count < 1) {
    return diceError("INVALID_DICE_COUNT", "Dice count must be at least 1.");
  }

  if (count > MAX_DICE_COUNT) {
    return diceError("TOO_MANY_DICE", `Dice count cannot exceed ${MAX_DICE_COUNT}.`);
  }

  if (!Number.isInteger(sides) || sides < 2) {
    return diceError("INVALID_SIDES", "Dice sides must be at least 2.");
  }

  if (sides > MAX_DICE_SIDES) {
    return diceError("TOO_MANY_SIDES", `Dice sides cannot exceed ${MAX_DICE_SIDES}.`);
  }

  if (keepCount !== undefined && (!Number.isInteger(keepCount) || keepCount < 1 || keepCount > count)) {
    return diceError("INVALID_KEEP_COUNT", "Keep count must be between 1 and the dice count.");
  }

  if (
    explodeOn !== undefined &&
    (!Number.isInteger(explodeOn) || explodeOn < 1 || explodeOn > sides)
  ) {
    return diceError("INVALID_EXPLODE_TARGET", "Explode target must be within the die range.");
  }

  return undefined;
}
