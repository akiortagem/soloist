import { parseDiceFormula } from "./diceParser";
import {
  MAX_ROLLS_PER_TERM,
  type DiceResult,
  type DiceRoll,
  type DiceRollBreakdownTerm,
  type DiceTerm,
  type DieRoll,
  type RandomNumberGenerator,
} from "./diceTypes";

const defaultRng: RandomNumberGenerator = Math.random;

export function rollDice(
  formula: string,
  rng: RandomNumberGenerator = defaultRng,
): DiceResult<DiceRoll> {
  const parsed = parseDiceFormula(formula);

  if (!parsed.ok) {
    return parsed;
  }

  const breakdown: DiceRollBreakdownTerm[] = [];
  let total = 0;

  for (const term of parsed.value.terms) {
    if (term.type === "modifier") {
      const subtotal = term.sign * term.value;
      breakdown.push({ ...term, subtotal });
      total += subtotal;
      continue;
    }

    const rolled = rollDiceTerm(term, rng);
    if (!rolled.ok) {
      return rolled;
    }

    breakdown.push(rolled.value);
    total += rolled.value.subtotal;
  }

  return {
    ok: true,
    value: {
      formula: parsed.value.formula,
      total,
      terms: breakdown,
    },
  };
}

function rollDiceTerm(
  term: DiceTerm,
  rng: RandomNumberGenerator,
): DiceResult<DiceRollBreakdownTerm> {
  const initialRolls = Array.from({ length: term.count }, () => rollDie(term.sides, rng));
  const keptInitialIndexes = getKeptInitialIndexes(initialRolls, term);
  const rolls: DieRoll[] = initialRolls.map((value, index) => ({
    value,
    kept: keptInitialIndexes.has(index),
    exploded: false,
  }));

  const keptValues: number[] = [];

  for (let index = 0; index < initialRolls.length; index += 1) {
    if (!keptInitialIndexes.has(index)) {
      continue;
    }

    let value = initialRolls[index];
    keptValues.push(value);

    while (term.explodeOn !== undefined && value === term.explodeOn) {
      if (rolls.length >= MAX_ROLLS_PER_TERM) {
        return {
          ok: false,
          error: {
            code: "TOO_MANY_ROLLS",
            message: `Exploding dice cannot roll more than ${MAX_ROLLS_PER_TERM} times per term.`,
          },
        };
      }

      rolls[index].exploded = true;
      value = rollDie(term.sides, rng);
      rolls.push({ value, kept: true, exploded: value === term.explodeOn });
      keptValues.push(value);
    }
  }

  const unsignedSubtotal = keptValues.reduce((sum, value) => sum + value, 0);
  const subtotal = term.sign * unsignedSubtotal;

  return {
    ok: true,
    value: {
      type: "dice",
      notation: term.notation,
      sign: term.sign,
      count: term.count,
      sides: term.sides,
      rolls,
      keptValues,
      subtotal,
      keep: term.keep,
      explodeOn: term.explodeOn,
    },
  };
}

function rollDie(sides: number, rng: RandomNumberGenerator): number {
  const randomValue = rng();
  const boundedValue = Math.min(Math.max(randomValue, 0), 0.9999999999999999);
  return Math.floor(boundedValue * sides) + 1;
}

function getKeptInitialIndexes(rolls: number[], term: DiceTerm): Set<number> {
  if (!term.keep) {
    return new Set(rolls.map((_, index) => index));
  }

  const sortedIndexes = rolls
    .map((value, index) => ({ value, index }))
    .sort((left, right) => {
      const valueDelta =
        term.keep?.mode === "highest" ? right.value - left.value : left.value - right.value;

      return valueDelta === 0 ? left.index - right.index : valueDelta;
    })
    .slice(0, term.keep.count)
    .map((roll) => roll.index);

  return new Set(sortedIndexes);
}
